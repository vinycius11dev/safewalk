import { demoIncidentCatalog } from '@safewalk/contracts';
export const nearbyIncidents = demoIncidentCatalog;
export const demoIncidents = demoIncidentCatalog.filter((incident) =>
  ['roubo', 'alagamento', 'calcada'].includes(incident.id),
);
