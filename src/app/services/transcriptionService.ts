import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);
const MODEL_NAME = "gemini-1.5-flash-8b";

/** Service for transcribing audio using Google Generative AI */
export class TranscriptionService {
  private model = genAI.getGenerativeModel({ model: MODEL_NAME });

  /**
   * Transcribe audio from base64 data
   * @param audioBase64 Base64-encoded audio data
   * @param mimeType MIME type of the audio (default: "audio/wav")
   * @returns Transcribed text
   */
  async transcribeAudio(
    audioBase64: string,
    mimeType: string = "audio/wav"
  ): Promise<string> {
    try {
      return "Transcription is disabled";
      const result = await this.model.generateContent([
        { inlineData: { mimeType, data: audioBase64 } },
        {
          text: "Please transcribe the spoken language in this audio accurately. Ignore any background noise or non-speech sounds.",
        },
      ]);
      return result.response.text();
    } catch (error) {
      console.error("Transcription error:", error);
      throw new Error(
        `Failed to transcribe audio: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
