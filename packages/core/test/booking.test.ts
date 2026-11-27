import { describe, expect, it } from "vitest";
import {
  BOOKING_FEE_OFF,
  bookingFeeDue,
  bookingFeeRefund,
  canMarkArrived,
  canRequestBackup,
  cancelOutcome,
  codeAttempt,
  completionFlags,
  customerStanding,
  demoCompletionCode,
  distanceMeters,
  holdOutcome,
  spotCheckCount,
} from "../src/booking";

const MIN = 60_000;
const t0 = Date.UTC(2026, 10, 27, 15, 0);

describe("provider fee: reserve, then charge or release", () => {
  it("charges on the first proof", () => {
    expect(holdOutcome({ kind: "code" })).toBe("charge");
    expect(holdOutcome({ kind: "gps_arrival" })).toBe("charge");
    expect(holdOutcome({ kind: "customer_fixed" })).toBe("charge");
  });
  it("charges after 60 minutes with no valid cancellation", () => {
    expect(holdOutcome({ kind: "timer", minutesSincePick: 59 })).toBe("hold");
    expect(holdOutcome({ kind: "timer", minutesSincePick: 60 })).toBe("charge");
  });
  it("releases when the customer cancels before arrival or the provider cancels", () => {
    expect(holdOutcome({ kind: "customer_cancelled_before_arrival" })).toBe("release");
    expect(holdOutcome({ kind: "provider_cancelled" })).toBe("release");
  });
  it("releases a no-show only with GPS at the location and a silent customer, up to 3 a month", () => {
    const base = { kind: "no_show", gpsAtLocation: true, customerResponded: false } as const;
    expect(holdOutcome({ ...base, releasesThisMonth: 0 })).toBe("release");
    expect(holdOutcome({ ...base, releasesThisMonth: 3 })).toBe("review");
    expect(holdOutcome({ ...base, gpsAtLocation: false, releasesThisMonth: 0 })).toBe("charge");
    expect(holdOutcome({ ...base, customerResponded: true, releasesThisMonth: 0 })).toBe("charge");
  });
});

describe("customer booking fee", () => {
  it("is off by default and due only when on or after 2 no-shows", () => {
    expect(bookingFeeDue(BOOKING_FEE_OFF, "ok")).toBe(0);
    expect(bookingFeeDue({ ...BOOKING_FEE_OFF, enabled: true }, "ok")).toBe(500);
    expect(bookingFeeDue(BOOKING_FEE_OFF, "fee_required")).toBe(500);
    expect(bookingFeeDue(BOOKING_FEE_OFF, "blocked")).toBeNull();
  });
  it("customer standing: 2 no-shows need the fee, 3 block", () => {
    expect(customerStanding(1)).toBe("ok");
    expect(customerStanding(2)).toBe("fee_required");
    expect(customerStanding(3)).toBe("blocked");
  });
  it("is refunded inside the 2-minute free cancel window and kept after it", () => {
    expect(cancelOutcome(t0, t0 + 119_000, BOOKING_FEE_OFF, false)).toEqual({
      providerFee: "release",
      bookingFee: "refund",
      lateCancel: false,
    });
    expect(cancelOutcome(t0, t0 + 121_000, BOOKING_FEE_OFF, false)).toMatchObject({
      bookingFee: "keep",
      lateCancel: true,
    });
  });
  it("refunds automatically when the provider cancels, is 30 minutes late, or no backup is found", () => {
    const base = { promisedAt: t0, arrivedAt: null, now: t0 + 10 * MIN };
    expect(bookingFeeRefund(base)).toBeNull();
    expect(bookingFeeRefund({ ...base, providerCancelled: true })).toBe("provider_cancelled");
    expect(bookingFeeRefund({ ...base, now: t0 + 31 * MIN })).toBe("provider_late");
    expect(bookingFeeRefund({ ...base, arrivedAt: t0 + 5 * MIN, now: t0 + 31 * MIN })).toBeNull();
    expect(
      bookingFeeRefund({ ...base, arrivedAt: t0, backupRequestedAt: t0, now: t0 + 31 * MIN }),
    ).toBe("no_backup_found");
    expect(
      bookingFeeRefund({
        ...base,
        arrivedAt: t0,
        backupRequestedAt: t0,
        newProviderFound: true,
        now: t0 + 31 * MIN,
      }),
    ).toBeNull();
    expect(bookingFeeRefund({ ...base, complaintApproved: true })).toBe("complaint");
  });
});

describe("tracking and proof", () => {
  it("shows the backup button 15 minutes after the promised arrival", () => {
    expect(canRequestBackup(t0, t0 + 15 * MIN, false)).toBe(false);
    expect(canRequestBackup(t0, t0 + 16 * MIN, false)).toBe(true);
    expect(canRequestBackup(t0, t0 + 16 * MIN, true)).toBe(false);
  });
  it("allows Arrived only within about 200 m", () => {
    const customer = { lat: 29.42, lng: -98.49 };
    expect(distanceMeters(customer, { lat: 29.4201, lng: -98.4901 })).toBeLessThan(20);
    expect(canMarkArrived({ lat: 29.4201, lng: -98.4901 }, customer)).toBe(true);
    expect(canMarkArrived({ lat: 29.43, lng: -98.49 }, customer)).toBe(false);
    expect(canMarkArrived(null, customer)).toBe(false);
  });
  it("locks the code after 5 wrong tries", () => {
    expect(codeAttempt("1234", "1234", 0).result).toBe("ok");
    expect(codeAttempt("1234", "0000", 3)).toEqual({ result: "wrong", tries: 4 });
    expect(codeAttempt("1234", "0000", 4)).toEqual({ result: "locked", tries: 5 });
    expect(codeAttempt("1234", "1234", 5).result).toBe("locked");
  });
  it("demo codes are 4 digits and stable", () => {
    expect(demoCompletionCode("job-1")).toMatch(/^\d{4}$/);
    expect(demoCompletionCode("job-1")).toBe(demoCompletionCode("job-1"));
  });
});

describe("warning signs and spot checks", () => {
  it("flags done without arriving, short jobs, the same device and many not-available", () => {
    const base = {
      arrivedAt: t0,
      doneAt: t0 + 20 * MIN,
      customerDevice: "a",
      providerDevice: "b",
      notAvailableLast30Days: 0,
      viaNotAvailable: false,
    };
    expect(completionFlags(base)).toEqual([]);
    expect(completionFlags({ ...base, arrivedAt: null })).toEqual(["done_without_arrival"]);
    expect(completionFlags({ ...base, doneAt: t0 + 4 * MIN })).toEqual(["short_job"]);
    expect(completionFlags({ ...base, providerDevice: "a" })).toEqual(["same_device"]);
    expect(completionFlags({ ...base, viaNotAvailable: true, notAvailableLast30Days: 3 })).toEqual([
      "many_not_available",
    ]);
  });
  it("spot checks 5% of finished jobs, at least one", () => {
    expect(spotCheckCount(0, 5)).toBe(0);
    expect(spotCheckCount(3, 5)).toBe(1);
    expect(spotCheckCount(100, 5)).toBe(5);
    expect(spotCheckCount(101, 5)).toBe(6);
  });
});

describe("economics: customer booking fees", () => {
  it("adds booking fees net of card fees only when set", async () => {
    const { computeEconomics } = await import("../src/economics");
    const base = {
      monthlyBudget: 4000,
      costPerClick: 4,
      clickToRequest: 0.25,
      acceptance: 0.7,
      serviceMix: { tow: 1 },
      feeByService: { tow: 42.5 },
      paymentFeeShare: 0.03,
      subscriptionsNet: 0,
      fixedCosts: 0,
    };
    const off = computeEconomics(base);
    expect(off.bookingFees).toBe(0);
    const on = computeEconomics({ ...base, bookingFee: 5, bookingFeeShare: 1 });
    expect(on.bookingFees).toBeCloseTo(off.accepted * 5 * 0.97, 6);
    expect(on.profit - off.profit).toBeCloseTo(on.bookingFees, 6);
  });
});
