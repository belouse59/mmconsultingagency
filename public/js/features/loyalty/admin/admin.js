"use strict";
/**
 * admin/admin.js  —  Entry point
 *
 * Imports all modules, wires cross-module dependencies (drawer loaders),
 * then calls boot() to initialize the console.
 *
 * Keep this file minimal: orchestration only, no business logic.
 */

import { $ } from "./ui.js";

import {
  MODULE_LABELS,
  State,
  switchModule,
  loadStats,
  loadDashboard,
  loadCustomers,
  loadPartners,
  loadPartnerRequests,
  loadOffers,
  loadRedemptions,
  loadNewsletter,
  loadContacts,
  loadSimulator,
} from "./modules.js";

import {
  setDrawerLoaders,
  openCreatePartnerDrawer,
  openCreateCustomerDrawer,
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

  // Verify session — will redirect to login if 401
  const session = await Api.get("/session");
  if (!session) return; // redirect already triggered

  // Set admin name in topbar
  const nameEl = $("#admTopbarUser");
  if (nameEl && session.data?.email) {
    nameEl.textContent = session.data.email.split("@")[0];
  }

  // Load default module
  switchModule("dashboard");
}