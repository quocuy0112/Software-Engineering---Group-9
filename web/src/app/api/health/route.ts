import { NextResponse } from "next/server";
import { getSystemHealth } from "@/backend/services/system/get-system-health";

export async function GET() {
  return NextResponse.json(await getSystemHealth());
}
