import "dotenv/config";

export type PosOnlineSalesResult = {
  date: string;
  totalRevenue: number;
  raw: any;
};

export async function fetchPosOnlineSalesByDate(
  date: string
): Promise<PosOnlineSalesResult> {
  const baseUrl = process.env.POS_ONLINE_BASE_URL;
  const apiKey = process.env.POS_ONLINE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing POS_ONLINE_BASE_URL or POS_ONLINE_API_KEY in backend/.env");
  }

  // TODO: Replace this with the REAL POS Online endpoint once you provide it.
  // For now we just throw so we don’t fake numbers.
  throw new Error("POS Online endpoint not configured yet");
}

