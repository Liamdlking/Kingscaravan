import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const formData = await req.formData();

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("guest-files")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage
    .from("guest-files")
    .getPublicUrl(filePath);

  return NextResponse.json({
    url: data.publicUrl,
    name: file.name,
  });
}