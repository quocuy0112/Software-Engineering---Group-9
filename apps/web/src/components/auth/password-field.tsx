"use client";
import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string };
export function PasswordField({ label, error, id: suppliedId, ...props }: Props) {
  const generatedId=useId(); const id=suppliedId ?? generatedId; const [visible,setVisible]=useState(false); const errorId=`${id}-error`;
  return <div className="field"><label htmlFor={id}>{label}</label><div className="password-control"><input {...props} id={id} type={visible?"text":"password"} aria-invalid={Boolean(error)} aria-describedby={error?errorId:props["aria-describedby"]}/><button type="button" className="secondary-action" aria-label={`${visible?"Hide":"Show"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible((value)=>!value)}>{visible?"Hide":"Show"}</button></div>{error?<p id={errorId} role="alert">{error}</p>:null}</div>;
}
