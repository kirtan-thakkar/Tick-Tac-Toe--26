import { NextResponse } from "next/server";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";

export async function POST(req) {
  try {
    const { prompt } = await req.json();
    const result = streamText({
      model: groq("openai/gpt-oss-120b"),
      prompt: prompt,
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    return NextResponse.json({
        error : error ? error.message : "Sorry, something went wrong. Please try again."
    },{status: 500});
  }
}
