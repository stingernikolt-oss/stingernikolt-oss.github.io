import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useKodus } from './useKodus';
import { type AvatarAsset, changePassword } from '@/services/kodusService';
export function useProfileForm() { const {member,saveMember}=useKodus(); const [name,setName]=useState(member?.full_name??''); const [asset,setAsset]=useState<AvatarAsset|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [saved,setSaved]=useState(false);
 useEffect(()=>{setName(member?.full_name??'');},[member?.full_name]);
 const choose=useCallback(async()=>{setError('');try{const p=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!p.granted)throw new Error('Разрешите доступ к фотографиям.');const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8,base64:true});if(!result.canceled){setAsset(result.assets[0]);setSaved(false);}}catch(e){setError(e instanceof Error?e.message:'Не удалось выбрать фото.');}},[]);
 const save=useCallback(async()=>{setError('');setSaved(false);if(name.trim().length<3||name.trim().length>120){setError('ФИО должно содержать от 3 до 120 символов.');return;}setBusy(true);try{await saveMember(name,asset);setAsset(null);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить профиль.');}finally{setBusy(false);}},[name,asset,saveMember]);
 return {name,setName,asset,busy,error,saved,choose,save}; }
export function usePasswordForm() { const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
 const save=useCallback(async()=>{setError('');setSaved(false);if(password.length<6){setError('Минимум 6 символов.');return;}if(password!==confirm){setError('Пароли не совпадают.');return;}setBusy(true);try{await changePassword(password);setPassword('');setConfirm('');setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить пароль.');}finally{setBusy(false);}},[password,confirm]);
 return {password,setPassword,confirm,setConfirm,busy,error,saved,save}; }
