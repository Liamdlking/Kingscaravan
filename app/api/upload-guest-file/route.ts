import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Keep uploads small for now so Vercel/Supabase does not hang
    const maxSize = 7 * 1024 * 1024; // 7MB
    if (file.size > 7 * 1024 * 1024) {
  setCustomEmailStatus("File is too large. Please upload a file under 7MB.");
  return;
}

    const supabase = supabaseServer();

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
    const fileName = `${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage
      .from("guest-files")
      .upload(fileName, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage
      .from("guest-files")
      .getPublicUrl(fileName);

    return NextResponse.json({
      ok: true,
      name: file.name,
      url: data.publicUrl,
    });
  } catch (err: any) {
    console.error("Upload route failed:", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}