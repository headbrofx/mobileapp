'use strict';

const AppError = require('../utils/appError');

// The booking lifecycle. Every action names the states it may be applied
// from; anything else is rejected with 409 CONFLICT rather than silently
// mutating a booking into an inconsistent state.
//
//   REQUESTED --assign--> ASSIGNED --accept--> ACCEPTED --onTheWay--> ON_THE_WAY
//                  ^          |                                          |
//                  |        reject                                    arrive
//                  |          v                                          v
//                  |      REJECTED                                   ARRIVED
//                  |                                                     |
//              reschedule                                              start
//                  |                                                     v
//                  +---------------------------------------------- IN_PROGRESS
//                                                                        |
//                                                                     complete
//                                                                        v
//                                                                   COMPLETED
//
// cancel is allowed from REQUESTED / ASSIGNED / ACCEPTED / ON_THE_WAY.
//
// Care Mobility adds three states around that spine:
//
//   UNDER_REVIEW  review: a dispatcher has picked up a REQUESTED one.
//                 Behaves like REQUESTED for everything else.
//   FAILED        fail: it was meant to happen and did not (no-show,
//                 breakdown). Set by a dispatcher, with a reason.
//   EXPIRED       expire: nobody was assigned before its time passed.
//                 Set by the system sweep, never by hand.
const ALLOWED_FROM = {
  review: ['REQUESTED'],
  assign: ['REQUESTED', 'UNDER_REVIEW', 'REJECTED', 'RESCHEDULED'],
  accept: ['ASSIGNED'],
  reject: ['ASSIGNED'],
  onTheWay: ['ACCEPTED'],
  arrive: ['ON_THE_WAY'],
  start: ['ARRIVED'],
  complete: ['IN_PROGRESS'],
  cancel: ['REQUESTED', 'UNDER_REVIEW', 'RESCHEDULED', 'REJECTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'],
  reschedule: ['REQUESTED', 'UNDER_REVIEW', 'RESCHEDULED', 'ASSIGNED', 'ACCEPTED'],
  fail: ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'],
  expire: ['REQUESTED', 'UNDER_REVIEW', 'RESCHEDULED', 'REJECTED'],
};

// Statuses nothing further happens to.
const TERMINAL = ['COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED'];

const TARGET_STATUS = {
  review: 'UNDER_REVIEW',
  assign: 'ASSIGNED',
  accept: 'ACCEPTED',
  reject: 'REJECTED',
  onTheWay: 'ON_THE_WAY',
  arrive: 'ARRIVED',
  start: 'IN_PROGRESS',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
  reschedule: 'RESCHEDULED',
  fail: 'FAILED',
  expire: 'EXPIRED',
};

function assertTransition(booking, action) {
  const allowedFrom = ALLOWED_FROM[action];
  if (!allowedFrom || !allowedFrom.includes(booking.status)) {
    throw AppError.conflict(`Cannot ${action} a booking currently in status ${booking.status}`);
  }
  return TARGET_STATUS[action];
}

module.exports = { ALLOWED_FROM, TARGET_STATUS, TERMINAL, assertTransition };
