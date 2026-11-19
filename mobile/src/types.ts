// One job, three stages: Task → Estimate → Invoice (see docs/product-decisions.md).

export type Kind = 'task' | 'estimate' | 'invoice';

/**
 * Task: created → done.
 * Estimate: created → sent.
 * Invoice: created → requested (waiting for money) → paid.
 */
export type Status = 'created' | 'done' | 'sent' | 'requested' | 'paid';

export interface Item {
  id: string;
  kind: Kind;
  status: Status;
  date: string; // YYYY-MM-DD, the day it shows on the calendar
  time?: string; // HH:MM (24h), tasks mostly
  clientName?: string; // empty = no customer yet (tasks only)
  address?: string;
  title: string; // short description of the work
  number?: string; // INV-0012 / EST-0004
  amount?: number; // total in dollars (estimates, invoices)
  dueDate?: string; // invoices: YYYY-MM-DD (past it and still Requested = overdue)
}

export type Filter = 'all' | 'task' | 'estimate' | 'invoice' | 'unpaid';
