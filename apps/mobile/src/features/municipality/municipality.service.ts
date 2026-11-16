import {
  emptyCaseState,
  emptyPointState,
  municipalityCaseStateSchema,
  pointStateSchema,
  type MunicipalityCaseState,
  type MunicipalityPointState,
} from './municipality.model';
import { readMunicipalityState, writeMunicipalityState } from './municipality-storage';

export const municipalityService = {
  async getCase(ownerId: string, caseId: string): Promise<MunicipalityCaseState> {
    const stored = await readMunicipalityState(ownerId, caseId);
    if (!stored) return emptyCaseState;
    return municipalityCaseStateSchema.parse(JSON.parse(stored));
  },
  async saveCase(
    ownerId: string,
    caseId: string,
    state: MunicipalityCaseState,
  ): Promise<MunicipalityCaseState> {
    const validated = municipalityCaseStateSchema.parse(state);
    await writeMunicipalityState(ownerId, caseId, JSON.stringify(validated));
    return validated;
  },
  async getPoint(ownerId: string, pointId: string): Promise<MunicipalityPointState> {
    const stored = await readMunicipalityState(ownerId, `point-${pointId}`);
    return stored ? pointStateSchema.parse(JSON.parse(stored)) : emptyPointState;
  },
  async savePoint(
    ownerId: string,
    pointId: string,
    state: MunicipalityPointState,
  ): Promise<MunicipalityPointState> {
    const validated = pointStateSchema.parse(state);
    await writeMunicipalityState(ownerId, `point-${pointId}`, JSON.stringify(validated));
    return validated;
  },
};
