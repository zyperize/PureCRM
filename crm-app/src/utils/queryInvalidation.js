export function invalidateLeadWorkspace(queryClient, leadId = null) {
  if (leadId) {
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['tasks', leadId] });
    queryClient.invalidateQueries({ queryKey: ['qualification-answers', leadId] });
  }

  queryClient.invalidateQueries({ queryKey: ['leads'] });
  queryClient.invalidateQueries({ queryKey: ['allTasks'] });
  queryClient.invalidateQueries({ queryKey: ['followUpTasks'] });
  queryClient.invalidateQueries({ queryKey: ['calendarTasks'] });
  queryClient.invalidateQueries({ queryKey: ['calendarFollowUps'] });
  queryClient.invalidateQueries({ queryKey: ['mapLeads'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-command-center'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-priority-worklist'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  queryClient.invalidateQueries({ queryKey: ['leads-by-stage'] });
  queryClient.invalidateQueries({ queryKey: ['leads-by-state'] });
}

export function invalidateCallWorkspace(queryClient, leadId = null) {
  invalidateLeadWorkspace(queryClient, leadId);
  queryClient.invalidateQueries({ queryKey: ['recent-calls'] });
  queryClient.invalidateQueries({ queryKey: ['calls-over-time'] });
  queryClient.invalidateQueries({ queryKey: ['callStats'] });
}
