"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
export default function CompanyInvitationPage(){const token=useSearchParams().get("token")??"";const csrf=useCsrfProof();const [message,setMessage]=useState("");async function accept(){const r=await fetch("/api/recruiter/company/team/invitations/accept",{method:"POST",headers:{"content-type":"application/json","x-csrf-token":csrf},body:JSON.stringify({token})});setMessage(r.ok?"You have joined the company.":"This invitation is unavailable.");}return <main><h1>Company invitation</h1><p>Accept this invitation to join the company.</p><button disabled={!token} onClick={()=>void accept()}>Accept invitation</button><p role="status">{message}</p></main>}
