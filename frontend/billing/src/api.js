/**
 * api.js — Shared Axios instance with automatic JWT injection and
 * automatic logout on token expiry or backend 401.
 *
 * All components should import { api } from "./api" instead of
 * using bare axios, so the Authorization header is always attached
 * and expired-session handling is centralised here.
 */
import axios from "axios";

export const API_BASE = "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: API_BASE });

/* ─── Request interceptor — attach JWT ──────────────────────────────────── */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ─── Response interceptor — auto-logout on 401 ────────────────────────── */
api.interceptors.response.use(
  // Pass through successful responses unchanged.
  (response) => response,

  // On any error response, check for 401 and fire a global logout event.
  (error) => {
    if (error.response?.status === 401) {
      // Clear the stale / expired token.
      localStorage.removeItem("access_token");
      // Dispatch a CustomEvent so App.jsx can switch to the login view
      // without prop-drilling a logout callback through every component.
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(error);
  }
);

/* ─── JWT payload decoder ───────────────────────────────────────────────── */

/**
 * Decode the payload section of a JWT without verifying the signature.
 * Verification is done server-side; this is purely for displaying user info.
 *
 * @param {string} token - A raw JWT string from localStorage.
 * @returns {object|null} The decoded payload object, or null on failure.
 */
export function decodeToken(token) {
  if (!token) return null;
  try {
    // A JWT is three base64url-encoded segments separated by dots.
    const base64Payload = token.split(".")[1];
    // Convert base64url → base64, then decode.
    const json = atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Return the display name embedded in the stored JWT, falling back to the
 * email address (sub claim) if the name claim is absent.
 *
 * @returns {string} The user's name or email, or an empty string if no token.
 */
export function getUserName() {
  const token = localStorage.getItem("access_token");
  const payload = decodeToken(token);
  if (!payload) return "";
  return payload.name || payload.sub || "";
}
export function getUserRole() {
  const token = localStorage.getItem("access_token");
  const payload = decodeToken(token);
  if (!payload) return "customer";
  return payload.role || "customer";
}
