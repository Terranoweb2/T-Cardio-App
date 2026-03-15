import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getEmergencySocket } from '@/lib/socket';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook that listens for real-time patient profile updates via WebSocket.
 * When a patient updates their profile, this invalidates the relevant
 * React Query caches so the doctor sees fresh data automatically.
 *
 * @param patientId - Optional specific patient ID to listen for.
 *   If provided, also invalidates the single patient query.
 */
export function usePatientUpdates(patientId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getEmergencySocket();

    const handlePatientUpdated = (data: {
      patientId: string;
      patientName: string;
      updatedFields: string[];
    }) => {
      // Always invalidate the doctor's patient list (dashboard + patients page)
      queryClient.invalidateQueries({ queryKey: queryKeys.doctor.patients });

      // If we're on a specific patient's detail page, also invalidate that
      if (patientId && data.patientId === patientId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.doctor.patient(patientId) });
      }
    };

    socket.on('patient_updated', handlePatientUpdated);

    return () => {
      socket.off('patient_updated', handlePatientUpdated);
    };
  }, [queryClient, patientId]);
}
