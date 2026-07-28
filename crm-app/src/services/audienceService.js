import { getSupabaseClient } from './supabase'
import { fetchAllRows, requireMutationRow } from './serviceUtils'

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null
  }
}

function customerNoteForLead(lead, orderTotal) {
  const lines = [
    `Converted from CRM lead: ${lead.business_name || 'Unnamed lead'}.`,
    orderTotal > 0 ? `Initial order recorded: $${orderTotal.toFixed(2)}.` : 'Initial order recorded without amount.',
    lead.id ? `Lead ID: ${lead.id}` : null
  ].filter(Boolean)
  return lines.join('\n')
}

function customerNoteForCapture(capture) {
  const lines = [
    'Promoted from storefront popup capture.',
    capture.offer_shown ? `Offer shown: ${capture.offer_shown}` : null,
    capture.source_page ? `Source page: ${capture.source_page}` : null,
    capture.id ? `Capture ID: ${capture.id}` : null
  ].filter(Boolean)
  return lines.join('\n')
}

function customerOrderNote(orderTotal) {
  return orderTotal > 0
    ? `Recorded customer order: $${orderTotal.toFixed(2)}.`
    : 'Recorded customer order without amount.'
}

const SUPPRESSED_CUSTOMER_STATUSES = new Set(['dnc', 'unsub', 'bounced'])

function normalizedSuppressedCustomerStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  return SUPPRESSED_CUSTOMER_STATUSES.has(normalized) ? normalized : null
}

function statusAfterCapturePromotion(existingStatus) {
  return normalizedSuppressedCustomerStatus(existingStatus) || 'active'
}

function statusAfterOrder(existingStatus) {
  return normalizedSuppressedCustomerStatus(existingStatus) || 'active'
}

async function findMostRecentCustomerByEmail(supabase, email, selectFields) {
  const { data, error } = await supabase
    .from('customers')
    .select(selectFields)
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

export const audienceService = {
  async getCustomers() {
    const supabase = getSupabaseClient()
    return fetchAllRows(() => (
      supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
    ))
  },

  async getWebsiteCaptures() {
    const supabase = getSupabaseClient()
    return fetchAllRows(() => (
      supabase
        .from('website_captures')
        .select('*')
        .order('created_at', { ascending: false })
    ))
  },

  async recordCustomerOrderFromLead(lead, orderTotal = 0) {
    const email = (lead?.email || lead?.manager_email || '').trim().toLowerCase()
    if (!email) {
      throw new Error('Cannot create a customer without an email address.')
    }

    const supabase = getSupabaseClient()
    const { firstName, lastName } = splitName(lead.manager_name || lead.business_name)
    const safeOrderTotal = Number.isFinite(Number(orderTotal)) ? Math.max(0, Number(orderTotal)) : 0
    const now = new Date().toISOString()

    const existing = await findMostRecentCustomerByEmail(
      supabase,
      email,
      'id, order_count, total_spent, notes, source, status'
    )

    const nextNotes = [
      existing?.notes?.trim(),
      customerNoteForLead(lead, safeOrderTotal)
    ].filter(Boolean).join('\n\n')

    if (existing?.id) {
      const { data, error } = await supabase
        .from('customers')
        .update({
          first_name: firstName,
          last_name: lastName,
          city: lead.city || null,
          state: lead.state || null,
          order_count: Number(existing.order_count || 0) + 1,
          total_spent: Number(existing.total_spent || 0) + safeOrderTotal,
          last_order_at: now,
          consented: true,
          status: statusAfterOrder(existing.status),
          source: existing.source || 'crm',
          notes: nextNotes
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle()

      if (error) throw error
      return requireMutationRow(data, 'Customer was not updated. Check database permissions and try again.')
    }

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        email,
        first_name: firstName,
        last_name: lastName,
        city: lead.city || null,
        state: lead.state || null,
        order_count: 1,
        total_spent: safeOrderTotal,
        last_order_at: now,
        source: 'crm',
        consented: true,
        status: 'active',
        notes: nextNotes
      }])
      .select()
      .maybeSingle()

    if (error) throw error
    return requireMutationRow(data, 'Customer was not created. Check database permissions and try again.')
  },

  async promoteCaptureToCustomer(capture) {
    const email = (capture?.email || '').trim().toLowerCase()
    if (!email) {
      throw new Error('Cannot promote a capture without an email address.')
    }

    if (!capture?.consented) {
      throw new Error('Only consented captures can be promoted to customers.')
    }

    const supabase = getSupabaseClient()
    const now = new Date().toISOString()

    const existing = await findMostRecentCustomerByEmail(
      supabase,
      email,
      'id, notes, source, consented, status'
    )

    const nextNotes = [
      existing?.notes?.trim(),
      customerNoteForCapture(capture)
    ].filter(Boolean).join('\n\n')

    let customer
    if (existing?.id) {
      const { data, error } = await supabase
        .from('customers')
        .update({
          source: existing.source || 'capture',
          consented: true,
          status: statusAfterCapturePromotion(existing.status),
          notes: nextNotes
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle()

      if (error) throw error
      customer = requireMutationRow(data, 'Customer was not updated. Check database permissions and try again.')
    } else {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          email,
          first_name: null,
          last_name: null,
          source: 'capture',
          order_count: 0,
          total_spent: 0,
          last_order_at: null,
          consented: true,
          status: 'active',
          notes: nextNotes,
          created_at: now
        }])
        .select()
        .maybeSingle()

      if (error) throw error
      customer = requireMutationRow(data, 'Customer was not created. Check database permissions and try again.')
    }

    const { data: promotedCapture, error: captureError } = await supabase
      .from('website_captures')
      .update({ promoted: true })
      .eq('id', capture.id)
      .select()
      .maybeSingle()

    if (captureError) throw captureError
    return {
      customer,
      capture: requireMutationRow(promotedCapture, 'Capture was not marked promoted. Check database permissions and try again.')
    }
  },

  async recordCustomerOrder(customer, orderTotal = 0) {
    if (!customer?.id) {
      throw new Error('Cannot record an order without a customer record.')
    }

    const supabase = getSupabaseClient()
    const safeOrderTotal = Number.isFinite(Number(orderTotal)) ? Math.max(0, Number(orderTotal)) : 0
    const nextNotes = [
      customer.notes?.trim(),
      customerOrderNote(safeOrderTotal)
    ].filter(Boolean).join('\n\n')

    const { data, error } = await supabase
      .from('customers')
      .update({
        order_count: Number(customer.order_count || 0) + 1,
        total_spent: Number(customer.total_spent || 0) + safeOrderTotal,
        last_order_at: new Date().toISOString(),
        consented: true,
        status: customer.status || 'active',
        notes: nextNotes
      })
      .eq('id', customer.id)
      .select()
      .maybeSingle()

    if (error) throw error
    return requireMutationRow(data, 'Customer order was not recorded. Check database permissions and try again.')
  }
}
