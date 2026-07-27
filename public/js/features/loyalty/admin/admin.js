"use strict";
/**
 * admin/admin.js  —  Entry point
 *
 * Imports all modules, wires cross-module dependencies (drawer loaders),
 * then calls boot() to initialize the console.
 *
 * Keep this file minimal: orchestration only, no business logic.
 */

import { $, Api } from "./ui.js";

import {
  switchModule,
  loadStats,
  loadPartners,
  loadPartnerRequests,
  loadCustomers,
  loadOffers,
} from "./modules.js";

import {
  setDrawerLoaders,
} from "./drawers.js";

async function boot() {
  // Wire drawer loaders to avoid circular imports between drawers.js
  // and modules.js. Both are fully initialised by the time boot() runs.
  setDrawerLoaders({
    loadPartners,
    loadPartnerRequests,
    loadCustomers,
    loadOffers,
    loadStats,
  });

  // Verify admin session — Api.get redirects to login on 401
  const session = await Api.get("/session");
  if (!session) return;

  // Set admin name in topbar if present
  const nameEl = $("#admTopbarUser");
  if (nameEl && session.data?.email) {
    nameEl.textContent = session.data.email.split("@")[0];
  }

  // Load default module — triggers loadStats() + loadDashboard()
  switchModule("dashboard");
}

boot();