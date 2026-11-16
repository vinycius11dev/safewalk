import { createContext, useContext, type PropsWithChildren } from 'react';
import type { ReportPhotoAsset } from './reports.service';

export type ReportPhotoPicker = () => Promise<ReportPhotoAsset | null>;
const ReportPhotoPickerContext = createContext<ReportPhotoPicker | null>(null);

/** App integration point for Expo ImagePicker or a platform-specific photo selector. */
export function ReportPhotoPickerProvider({
  children,
  pickPhoto,
}: PropsWithChildren<{ pickPhoto: ReportPhotoPicker }>) {
  return (
    <ReportPhotoPickerContext.Provider value={pickPhoto}>
      {children}
    </ReportPhotoPickerContext.Provider>
  );
}

export function useReportPhotoPicker() {
  return useContext(ReportPhotoPickerContext);
}
