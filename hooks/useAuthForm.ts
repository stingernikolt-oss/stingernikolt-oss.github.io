import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as api from '@/services/kodusService';
import { useKodus } from './useKodus';
export function useAuthForm() {
 const {setRegistrationAvatar}=useKodus(); const [mode,setMode]=useState<'login'|'register'|'verify'>('login');
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [name,setName]=useState(''); const [login,setLogin]=useState(''); const [code,setCode]=useState('');
 const [avatar,setAvatar]=useState<api.AvatarAsset|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 const switchMode=useCallback((next:'login'|'register')=>{ setMode(next); setError(''); setNotice(''); },[]);
 const chooseAvatar=useCallback(async()=>{ try { const permission=await ImagePicker.requestMediaLibraryPermissionsAsync(); if(!permission.granted) throw new Error('Разрешите доступ к фотографиям в настройках устройства.'); const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8,base64:true}); if(!result.canceled) { const asset=result.assets[0]; if((asset.fileSize??0)>5242880) throw new Error('Размер изображения должен быть до 5 МБ.'); setAvatar(asset); } }catch(e){setError(e instanceof Error?e.message:'Не удалось выбрать аватар.');} },[]);
 const submit=useCallback(async()=>{
  setError(''); setNotice('');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Введите корректный email.'); return; }
  if(mode==='verify' && !/^\d{4}$/.test(code)) {setError('Введите четырёхзначный код из письма.');return;}
  if(mode!=='verify' && password.length<6) {setError('Пароль должен содержать минимум 6 символов.');return;}
  if(mode==='register') {
   if(name.trim().length<3 || name.trim().length>120) {setError('Укажите ФИО от 3 до 120 символов.');return;}
   if(!/^[a-z0-9_]{3,24}$/.test(login.trim().toLowerCase())) {setError('Логин: 3–24 латинских символа, цифры или _.');return;}
   if(password!==confirm) {setError('Пароли не совпадают.');return;}
  }
  setBusy(true);
  try {
   if(mode==='login') await api.signIn(email,password);
   else if(mode==='verify') await api.verifyRegistration(email,code);
   else { setRegistrationAvatar(avatar); const data=await api.register(email,password,name,login); if(!data.session) {setMode('verify');setNotice('Код отправлен на ваш email. Проверьте также папку «Спам».');} }
  }catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить запрос.');}finally{setBusy(false);}
 },[mode,email,password,confirm,name,login,code,avatar,setRegistrationAvatar]);
 const resend=useCallback(async()=>{setBusy(true);setError('');try{await api.resendCode(email);setNotice('Новый код отправлен на email.');}catch(e){setError(e instanceof Error?e.message:'Не удалось отправить код.');}finally{setBusy(false);}},[email]);
 return {mode,switchMode,email,setEmail,password,setPassword,confirm,setConfirm,name,setName,login,setLogin,code,setCode,avatar,chooseAvatar,busy,error,notice,submit,resend};
}
