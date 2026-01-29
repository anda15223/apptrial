import { Router } from "express";
import fetch from "node-fetch";
import crypto from "crypto";

export const plandayRouter = Router();

const AUTHORIZE_URL = "https://id.planday.com/connect/authorize";
const TOKEN_URL = "https://id.planday.com/connect/token";
const API_BASE = "https://openapi.planday.com";

/* ================= AUTHORIZE ================= */
plandayRouter.get("/authorize", (_req, res) => {
  const clientId = process.env.PLANDAY_CLIENT_ID!;
  const redirectUri = process.env.PLANDAY_REDIRECT_URI!;
  const scope = process.env.PLANDAY_SCOPE || "openid offline_access";

  const state = crypto.randomBytes(16).toString("hex");

  const url =
    `${AUTHORIZE_URL}` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;

  res.redirect(url);
});

/* ================= CALLBACK ================= */
plandayRouter.get("/callback", async (req, res) => {
  const clientId = process.env.PLANDAY_CLIENT_ID!;
  const clientSecret = process.env.PLANDAY_CLIENT_SECRET!;
  const redirectUri = process.env.PLANDAY_REDIRECT_URI!;
  const code = req.query.code as string;

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  res.json(await tokenRes.json());
});

/* ================= SALARY KPI (RAW TIME & COST DEBUG) ================= */
plandayRouter.get("/salary-kpi", async (req, res) => {
  const departmentId = req.query.departmentId as string;
  const date = req.query.date as string;

  const clientId = process.env.PLANDAY_CLIENT_ID!;
  const clientSecret = process.env.PLANDAY_CLIENT_SECRET!;
  const refreshToken = process.env.PLANDAY_REFRESH_TOKEN!;

  /* ---- access token ---- */
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const tokenJson: any = await tokenRes.json();
  const accessToken = tokenJson.access_token;

  /* ---- time & cost ---- */
  const costRes = await fetch(
    `${API_BASE}/timeandcost/v1.0/entries?departmentId=${departmentId}&from=${date}&to=${date}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-ClientId": clientId,
      },
    }
  );

  const text = await costRes.text();

  if (!text || text.startsWith("<")) {
    return res.json({
      date,
      departmentId: Number(departmentId),
      rawRows: [],
      note: "No time & cost data or HTML response",
    });
  }

  const data = JSON.parse(text);

  /* ---- RETURN RAW ROWS FOR FIELD INSPECTION ---- */
  return res.json({
    date,
    departmentId: Number(departmentId),
    rawRows: data.data,
  });
});
