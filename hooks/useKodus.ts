import { useContext, useMemo } from 'react';
import { KodusContext } from '@/contexts/KodusContext';
import { avatarUrl } from '@/services/kodusService';
export function useKodus() { const value=useContext(KodusContext); if(!value) throw new Error('KodusProvider required'); return value; }
export function useAvatarUrl(path?:string|null) { return useMemo(() => avatarUrl(path),[path]); }
