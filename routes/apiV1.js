/**
 * API Routes
 * ----------------------------------------
 * This file defines all application routes
 * and maps them to their respective controllers.
 */

const express = require('express');
const router = express.Router();

/**
 * Controllers
 */
const businessController = require('../controllers/businessController');
const systemUserController = require('../controllers/systemUserController');
const eventController = require('../controllers/eventController');
const ruleController = require('../controllers/ruleController');
const listController = require('../controllers/listController');
const customerController = require('../controllers/customerController');
const authController = require('../controllers/authController');
const decisionController = require('../controllers/decisionController');
const alertController = require('../controllers/alertController');
const auditLogController = require('../controllers/auditLogController');
const dashboardController = require('../controllers/dashboardController');
const caseController = require('../controllers/caseController');
const pepController = require('../controllers/pepController');

/**
 * Middlewares
 */
const { ensureBusinessContext, protect, validateApiKey } = require('../middlewares');

/* =========================================================
   Public / Setup Routes
   ========================================================= */
router.get('/dashboard/stats', protect, ensureBusinessContext, dashboardController.getDashboardStats);
/**
 * Business Management
 */
// Create a new business
// POST /businesses
router.post('/businesses', businessController.createBusiness);

/**
 * System User Management
 */
// Create a system user
// POST /system-users
router.post('/system-users', systemUserController.createSystemUser);

/* =========================================================
   Authentication & Authorization
   ========================================================= */

/**
 * Magic Link Authentication
 */
// Send magic login link
// POST /auth/magic-link
router.post('/auth/magic-link', systemUserController.sendMagicLink);

// Verify magic link token
// POST /auth/verify-magic-token
router.post('/auth/verify-magic-token', systemUserController.verifyMagicLink);

/**
 * Multi-Factor Authentication (MFA)
 */
// Generate MFA QR code
// POST /auth/generate-mfa
router.post('/auth/generate-mfa', systemUserController.generateMfa);

// Confirm MFA setup
// POST /auth/confirm-mfa-setup
router.post('/auth/confirm-mfa-setup', systemUserController.confirmMfaSetup);

// Verify MFA code
// POST /auth/verify-mfa
router.post('/auth/verify-mfa', systemUserController.verifyMfa);

/**
 * Session Management
 */
// Check authentication status
// POST /auth/check-auth
router.post('/auth/check-auth', authController.checkAuth);

// Logout user
// POST /auth/logout
router.post('/auth/logout', authController.logout);

/* =========================================================
   Business Context Protected Routes
   ========================================================= */

/**
 * Events
 */
// Create an event
// POST /events
router.post('/events', validateApiKey, eventController.createEvent);

// Get all events for a business
// POST /get-events
router.post('/get-events', protect, ensureBusinessContext, eventController.getEvents);

/**
 * Rules
 */
// Create a rule
// POST /rules
router.post('/rules', protect, ruleController.createRule);

// Get all rules for a business
// POST /get-rules
router.post('/get-rules', protect, ensureBusinessContext, ruleController.getRules);

// Get rule by ID
// GET /rules/:id
router.get('/rules/:id', protect, ensureBusinessContext, ruleController.getRule);

// Update rule
// PUT /rules/:id
router.put('/rules/:id', protect, ensureBusinessContext, ruleController.updateRule);

// Toggle rule status (enable/disable)
// PATCH /rules/:id
router.patch('/rules/:id', protect, ensureBusinessContext, ruleController.toggleRuleStatus);

// Delete rule
// DELETE /rules/:id
router.delete('/rules/:id', protect, ensureBusinessContext, ruleController.deleteRule);

router.post('/rules/test-logic', protect, ensureBusinessContext, ruleController.testRuleLogic);


/**
 * Lists
 */
// Create a list
// POST /lists
router.post('/lists', protect, listController.createList);

// Get all lists for a business
// POST /get-lists
router.post('/get-lists', protect, ensureBusinessContext, listController.getLists);

/**
 * Decisions
 */
// Override a decision
// PATCH /:id/override
router.patch('/:id/override', protect, ensureBusinessContext, decisionController.overrideDecision);

/**
 * Customers
 */

// Register a customer
// POST /customers
router.post('/customers', validateApiKey, customerController.registerCustomer);


// Get all customers
// GET /customers
router.get('/customers', protect, ensureBusinessContext, customerController.getCustomers);

// Get customer by ID
// GET /customers/:id
router.get('/customers/:id', protect, ensureBusinessContext, customerController.getCustomerById);

// Get customer decision/history
// GET /customers/:id/history
router.get('/customers/:id/history', protect, ensureBusinessContext, customerController.getCustomerHistory);

router.get('/cases', protect, caseController.getCases);
router.get('/cases/:id', protect, caseController.getCaseById);
router.patch('/cases/:id/resolve', protect, caseController.resolveCase);

router.get('/pep/search', protect, pepController.searchPep);

/**
 * Alerts
 */
// Create an alert
// POST /alerts
router.post('/alerts', protect, ensureBusinessContext, alertController.createAlert);

// Delete an alert
// DELETE /alerts/:id
router.delete('/alerts/:id', protect, ensureBusinessContext, alertController.deleteAlert);

// Get alerts for a specific customer
// GET /customers/:id/alerts
router.get('/customers/:id/alerts', protect, ensureBusinessContext, alertController.getCustomerAlerts);

// Get alert logs for a customer
// GET /customers/:id/alert-logs
router.get('/customers/:id/alert-logs', protect, ensureBusinessContext, alertController.getCustomerAlertLogs);

// Get global alert feed
// GET /alerts/global-feed
router.get('/alerts/global-feed', protect, ensureBusinessContext, alertController.getGlobalAlertFeed);

/**
 * Business Settings
 */
// Get business settings
// GET /settings
router.get('/settings', protect, ensureBusinessContext, businessController.getSettings);

// Update business settings
// PATCH /settings
router.patch('/settings', protect, ensureBusinessContext, businessController.updateSettings);

// Rotate API key
// POST /settings/rotate-key
router.post('/settings/rotate-key', protect, ensureBusinessContext, businessController.rotateApiKey);

/**
 * Audit Logs
 */
// Get audit logs
// GET /audit-logs
router.get('/audit-logs', protect, ensureBusinessContext, auditLogController.getAuditLogs);

// Log Sanction Screening in audit logs
// POST /audit-logs
router.post('/audit-logs/manual-screen', protect, ensureBusinessContext, auditLogController.logSanctionScreening);


/* ========================================================= */

module.exports = router;
