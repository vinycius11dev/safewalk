import type { FloodRouteAssessment } from '@safewalk/contracts';

export type FloodAssessmentBadge = {
  label: string;
  tone: 'neutral' | 'warning' | 'danger';
};

export function floodAssessmentBadge(assessment: FloodRouteAssessment): FloodAssessmentBadge {
  switch (assessment.recommendation) {
    case 'avoid':
      return { label: 'Evite este trajeto', tone: 'danger' };
    case 'caution':
      return { label: 'Atenção à inundação', tone: 'warning' };
    case 'history':
      return { label: 'Histórico / modelo próximo', tone: 'neutral' };
    case 'lower_known_exposure':
      return { label: 'Menos registros conhecidos', tone: 'neutral' };
    case 'no_reported_incident':
      return { label: 'Nenhuma ocorrência localizada', tone: 'neutral' };
    case 'unknown':
      return { label: 'Dados insuficientes', tone: 'warning' };
  }
}

export function shouldShowFloodAssessmentInline(assessment: FloodRouteAssessment): boolean {
  return assessment.recommendation !== 'unknown' && assessment.recommendation !== 'history';
}
