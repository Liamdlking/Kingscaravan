import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // 7MB limit
    const maxSize = 7 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File is too large. Please upload a file under 7MB." },
        { status: 400 }
      );
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

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
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