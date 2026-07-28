import { useState } from 'react'
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'
import { leadsService } from '../services/leadsService'
import toast from 'react-hot-toast'

const normalizeHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')

function normalizeImportRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  )
}

export default function UploadData() {
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [duplicates, setDuplicates] = useState([])
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [pendingLeads, setPendingLeads] = useState([])

  const normalizeKey = (value) => String(value || '').trim().toLowerCase()

  const duplicateKeyFor = (lead, matchReason) => {
    if (matchReason === 'Same phone number') {
      const phone = String(lead.phone || '').replace(/\D/g, '').slice(-10)
      return phone ? `phone:${phone}` : null
    }
    const name = normalizeKey(lead.business_name)
    const city = normalizeKey(lead.city)
    return name && city ? `name-city:${name}:${city}` : null
  }

  const parseNumberField = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const parseIntegerField = (value) => {
    const parsed = parseNumberField(value)
    return parsed === null ? null : Math.trunc(parsed)
  }

  const setImportFailure = (error) => {
    setImportResults({
      success: false,
      error: error?.message || 'Import failed'
    })
  }

  const parseJSONField = (value) => {
    if (!value || String(value).trim() === '') return null
    if (typeof value === 'object') return value
    try {
      return JSON.parse(value)
    } catch {
      console.warn('Failed to parse JSON field:', value)
      return null
    }
  }

  const mapImportRow = (sourceRow) => {
    const row = normalizeImportRow(sourceRow)
    const pick = (...fields) => fields.map((field) => row[field]).find((value) => (
      value !== undefined && value !== null && String(value).trim() !== ''
    ))
    const contactName = pick('contact_name', 'full_name', 'lead_name')
      || [pick('first_name', 'firstname'), pick('last_name', 'lastname')].filter(Boolean).join(' ')
    const email = pick('email', 'email_address', 'work_email', 'business_email')
    const phone = pick('phone', 'phone_number', 'telephone', 'mobile', 'mobile_phone', 'cell')
    const businessName = pick(
      'business_name',
      'company_name',
      'company',
      'business',
      'organization',
      'organisation',
      'account_name',
      'account',
      'name'
    ) || contactName || email || phone

    const lead = {
      business_name: businessName,
      manager_name: pick('manager_name', 'contact_person', 'decision_maker') || contactName,
      manager_email: pick('manager_email'),
      phone,
      email,
      website: pick('website', 'website_url', 'company_website', 'url'),
      street_address: pick('street_address', 'address', 'address_1', 'address_line_1'),
      city: pick('city', 'town'),
      state: pick('state', 'province', 'region'),
      zipcode: pick('zipcode', 'zip', 'postal_code', 'postcode'),
      county: pick('county'),
      full_address: pick('full_address'),
      latitude: parseNumberField(pick('latitude', 'lat')),
      longitude: parseNumberField(pick('longitude', 'lng', 'lon')),
      google_places_id: pick('google_places_id', 'place_id'),
      yelp_id: pick('yelp_id'),
      business_type: pick('business_type', 'type'),
      rating: parseNumberField(pick('rating', 'google_rating')),
      reviews_count: parseIntegerField(pick('reviews_count', 'review_count', 'reviews')),
      price_level: parseIntegerField(pick('price_level')),
      phone_formatted: pick('phone_formatted'),
      opening_hours: parseJSONField(pick('opening_hours_json', 'opening_hours')),
      photos: parseJSONField(pick('photos_json', 'photos')),
      cover_photo_url: pick('cover_photo_url', 'main_photo'),
      google_maps_url: pick('google_maps_url', 'maps_url'),
      description: pick('description', 'notes'),
      amenities: parseJSONField(pick('amenities')),
      category: pick('category') || 'prospect',
      lead_source: pick('lead_source', 'source') || 'file_import',
      lead_stage: pick('lead_stage', 'stage', 'status') || 'new',
      tags: pick('tags')
        ? String(pick('tags')).split(/[,;]/).map((tag) => tag.trim()).filter(Boolean)
        : null,
    }

    return Object.fromEntries(
      Object.entries(lead).filter(([, value]) => (
        value !== null && value !== undefined && value !== ''
      ))
    )
  }

  const loadRows = (rows, filename) => {
    const mapped = rows.map(mapImportRow)
    if (!mapped.length) {
      toast.error('No data found in that file')
      return
    }
    setPreviewData(mapped)
    setImportResults(null)
    setDuplicates([])
    setPendingLeads([])
    setShowDuplicateWarning(false)
    toast.success(`Loaded ${mapped.length} rows from ${filename}. Review and import.`)
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (/\.xlsx$/i.test(file.name)) {
      try {
        const [headerRow = [], ...dataRows] = await readSheet(file)
        const headers = headerRow.map((header) => String(header || ''))
        const rows = dataRows
          .filter((values) => values.some((value) => value !== null && value !== ''))
          .map((values) => Object.fromEntries(
            headers.map((header, index) => [header, values[index] ?? ''])
          ))
        loadRows(rows, file.name)
      } catch (error) {
        toast.error(`Could not read Excel file: ${error.message}`)
      }
      event.target.value = ''
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        loadRows(results.data || [], file.name)
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`)
      }
    })
    event.target.value = ''
  }

  const handleImport = async () => {
    if (!previewData || previewData.length === 0) {
      toast.error('No data to import')
      return
    }

    setImporting(true)
    setImportResults(null)

    try {
      const leads = previewData
      const validLeads = leads.filter((lead) => (
        lead.business_name || lead.email || lead.phone
      ))

      if (validLeads.length === 0) {
        toast.error('No valid leads found. Each row needs a name, email, or phone.')
        setImporting(false)
        return
      }

      // Check for duplicates
      const duplicateToastId = toast.loading('Checking for duplicates...')
      const foundDuplicates = await leadsService.findDuplicates(validLeads)
      toast.dismiss(duplicateToastId)

      if (foundDuplicates.length > 0) {
        // Show duplicate warning modal
        setDuplicates(foundDuplicates)
        setPendingLeads(validLeads)
        setShowDuplicateWarning(true)
        setImporting(false)
        return
      }

      // No duplicates, proceed with import
      const imported = await leadsService.bulkImportLeads(validLeads)

      setImportResults({
        success: true,
        imported: imported.length,
        skipped: leads.length - validLeads.length,
        duplicates: 0,
        total: leads.length
      })

      toast.success(`Successfully imported ${imported.length} leads!`)
      setPreviewData(null) // Clear preview after successful import

    } catch (error) {
      setImportFailure(error)
      toast.error(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleSkipDuplicates = async () => {
    setShowDuplicateWarning(false)
    setImporting(true)

    try {
      // Get duplicate lead identifiers (business_name + phone)
      const duplicateIdentifiers = new Set(
        duplicates
          .map(d => duplicateKeyFor(d.newLead, d.matchReason))
          .filter(Boolean)
      )

      // Filter out duplicates from pending leads
      const leadsToImport = pendingLeads.filter(lead => {
        const phoneKey = duplicateKeyFor(lead, 'Same phone number')
        const nameCityKey = duplicateKeyFor(lead, 'Same business name and city')
        return !duplicateIdentifiers.has(phoneKey) && !duplicateIdentifiers.has(nameCityKey)
      })

      if (leadsToImport.length === 0) {
        toast.error('All leads are duplicates. Nothing to import.')
        setImporting(false)
        return
      }

      // Import non-duplicate leads
      const imported = await leadsService.bulkImportLeads(leadsToImport)

      setImportResults({
        success: true,
        imported: imported.length,
        skipped: pendingLeads.length - leadsToImport.length,
        duplicates: duplicates.length,
        total: pendingLeads.length
      })

      toast.success(`Imported ${imported.length} leads, skipped ${duplicates.length} duplicates`)
      setPreviewData(null)
      setPendingLeads([])
      setDuplicates([])
    } catch (error) {
      setImportFailure(error)
      toast.error(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleImportAnyway = async () => {
    setShowDuplicateWarning(false)
    setImporting(true)

    try {
      // Import all pending leads regardless of duplicates
      const imported = await leadsService.bulkImportLeads(pendingLeads)

      setImportResults({
        success: true,
        imported: imported.length,
        skipped: 0,
        duplicates: duplicates.length,
        total: pendingLeads.length
      })

      toast.success(`Imported ${imported.length} leads (including ${duplicates.length} potential duplicates)`)
      setPreviewData(null)
      setPendingLeads([])
      setDuplicates([])
    } catch (error) {
      setImportFailure(error)
      toast.error(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    try {
      const leads = await leadsService.getAllLeadsForExport()

      if (!leads || leads.length === 0) {
        toast.error('No leads to export')
        return
      }

      // Convert to CSV
      const csv = Papa.unparse(leads)

      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crm_leads_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${leads.length} leads`)
    } catch (error) {
      toast.error(`Export failed: ${error.message}`)
    }
  }

  const downloadTemplate = () => {
    const templateData = [{
      business_name: 'Example Company',
      phone: '(555) 123-4567',
      email: 'info@example.com',
      website: 'https://example.com',
      street_address: '123 Main St',
      city: 'Denver',
      state: 'CO',
      zipcode: '80202',
      county: 'Denver County',
      latitude: '39.7392',
      longitude: '-104.9903',
      google_places_id: 'ChIJ...',
      opening_hours_json: '{"monday":"9am-8pm","tuesday":"9am-8pm"}',
      rating: '4.5',
      reviews_count: '127',
      photos_json: '["https://photo1.jpg","https://photo2.jpg"]',
      cover_photo_url: 'https://photo1.jpg',
      google_maps_url: 'https://maps.google.com/?cid=123',
      description: 'Example business description',
      manager_name: 'Mike Johnson',
      category: 'prospect',
      lead_source: 'google_scrape',
      tags: 'organic,wellness,premium'
    }]

    const csv = Papa.unparse(templateData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Downloaded template CSV')
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Import/Export Data</h1>
      <p className="text-gray-400 mb-8">Bring an Excel or CSV lead sheet. The CRM recognizes common column names automatically.</p>

      {/* Import Section */}
      <div className="bg-charcoal-800 border border-white/10 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-gold-400" />
            Import Excel or CSV
          </h2>
          <button
            onClick={downloadTemplate}
            className="btn-secondary text-sm"
          >
            <FileText className="w-4 h-4" />
            Download Template
          </button>
        </div>

        <div className="bg-charcoal-900 border border-gold-400/20 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-300">
            <strong>Minimum needed:</strong> a company/contact name, email, or phone. Everything else is optional.
            Common headings such as Company, Full Name, Work Email, Mobile, Status, Address, and Notes are recognized.
          </p>
          <p className="text-sm text-gray-300 mt-2">
            See <code className="bg-charcoal-800 text-gold-300 px-1 rounded">CSV-IMPORT-GUIDE.md</code> for complete field reference.
          </p>
        </div>

        <label className="block">
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-gold-500/50 bg-charcoal-900 cursor-pointer transition">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-lg font-medium text-gray-300">Choose an Excel or CSV file</p>
            <p className="text-sm text-gray-500 mt-1">.xlsx or .csv</p>
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </label>

        {/* Preview */}
        {previewData && (
          <div className="mt-6">
            <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Loaded <strong>{previewData.length} rows</strong> and matched the columns below
              </p>
            </div>

            <div className="overflow-x-auto border border-white/10 rounded-xl mb-4">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-charcoal-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Business Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Phone</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">City</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">State</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rating</th>
                  </tr>
                </thead>
                <tbody className="bg-charcoal-800 divide-y divide-white/5 text-gray-300">
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm">{row.business_name || '-'}</td>
                      <td className="px-4 py-2 text-sm">{row.phone || '-'}</td>
                      <td className="px-4 py-2 text-sm">{row.city || '-'}</td>
                      <td className="px-4 py-2 text-sm">{row.state || '-'}</td>
                      <td className="px-4 py-2 text-sm">{row.rating || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 5 && (
                <div className="bg-charcoal-900 px-4 py-2 text-sm text-gray-400 text-center">
                  ... and {previewData.length - 5} more rows
                </div>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : `Import ${previewData.length} Leads`}
            </button>
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className={`mt-6 rounded-xl p-4 ${importResults.success ? 'bg-emerald-500/10 border border-emerald-400/20' : 'bg-red-500/10 border border-red-400/20'}`}>
            {importResults.success ? (
              <div className="text-emerald-300">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  Import Successful!
                </p>
                <p className="mt-2">Imported: <strong>{importResults.imported}</strong> leads</p>
                {importResults.duplicates > 0 && (
                  <p className="mt-1">Duplicates skipped: <strong>{importResults.duplicates}</strong></p>
                )}
                {importResults.skipped > 0 && (
                  <p className="mt-1">Invalid rows skipped: <strong>{importResults.skipped}</strong> (missing name, email, and phone)</p>
                )}
              </div>
            ) : (
              <div className="text-red-300">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-5 h-5" />
                  Import Failed
                </p>
                <p className="mt-2">{importResults.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="bg-charcoal-800 border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-gold-400" />
          Export Leads to CSV
        </h2>

        <p className="text-gray-400 mb-4">
          Download all your leads as a CSV file with all fields included.
        </p>

        <button
          onClick={handleExport}
          className="btn-primary"
        >
          <Download className="w-4 h-4" />
          Export All Leads
        </button>
      </div>

      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-charcoal-800 border border-white/10 rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-amber-500/10 border-b border-gold-400/20 p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-gold-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Duplicate Leads Detected</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Found <strong>{duplicates.length}</strong> potential {duplicates.length === 1 ? 'duplicate' : 'duplicates'} in your import
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              <p className="text-sm text-gray-300 mb-4">
                The following leads match existing records by phone number or business name + city:
              </p>

              <div className="space-y-3">
                {duplicates.slice(0, 10).map((dup, idx) => (
                  <div key={idx} className="bg-charcoal-900 border border-white/5 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-white">{dup.newLead.business_name}</p>
                        <p className="text-sm text-gray-400">{dup.newLead.phone} • {dup.newLead.city}</p>
                      </div>
                      <span className="px-2 py-1 bg-amber-500/10 text-gold-300 border border-gold-400/20 text-xs rounded-full">
                        {dup.matchReason}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Matches existing: <strong>{dup.existingLead.business_name}</strong>
                    </p>
                  </div>
                ))}
                {duplicates.length > 10 && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    ... and {duplicates.length - 10} more duplicates
                  </p>
                )}
              </div>
            </div>

            <div className="bg-charcoal-900 border-t border-white/10 p-6 flex gap-3">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSkipDuplicates}
                className="btn-primary flex-1"
              >
                Skip Duplicates ({pendingLeads.length - duplicates.length} leads)
              </button>
              <button
                onClick={handleImportAnyway}
                className="btn-danger flex-1"
              >
                Import Anyway ({pendingLeads.length} leads)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
