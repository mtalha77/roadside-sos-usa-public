# Dispatch playbook (test campaign, manual dispatch)

For dispatchers working the Admin **Inbox** during the 14-day test campaign. Every request is
handled by hand: you talk to the driver, call providers, assign one, and follow the job to the
end. Keep calls short, calm and kind: the driver is stressed and often on a road shoulder.

## Before your shift

1. Admin > Settings > On duty: your mobile number is set; switch on "I am on duty now" (or check
   the weekly schedule has you).
2. Open the Inbox and the Phone dock (bottom right). Set yourself **Available** and allow the
   microphone when the browser asks.
3. Turn on "Sound and notifications" in the Inbox.

## The steps (every request)

New → **Contacted** → **Location confirmed** → **Provider assigned** → **On the way** →
**Arrived** → **Completed**, or **Cancelled** / **No provider found** (a reason is required).

1. **Claim** it (others then see you have it). A claim lapses after 10 minutes without action.
2. **Contact the driver** within 2 minutes: call from the request (Call button). No texts in this campaign (owner decision).
   Mark **Contacted**.
3. **Safety first** (every call):
   > "Are you in a safe place right now? If you're in traffic or feel unsafe, please hang up and
   > call 911 first. We'll keep working on your help."
4. **Location**: if the driver used Get Help with GPS, check the map. Otherwise press **Location
   link**. If the driver gave an email, it is emailed. If not, read the words on screen: "Go to
   {site}/l and type the code 482 917" (the code is shown, 6 digits), then press **I read it to
   the driver**. The pin appears on the timeline within seconds of them sharing it. If
   they can't, type the address or cross streets in the intake form. Mark **Location confirmed**.
5. **Service and vehicle**: fill the intake (name, service, vehicle, notes: exit, direction,
   landmark, colour of the car).
6. **Find a provider**: the panel lists nearby active providers for that service, nearest first,
   with their price, last response time and acceptance rate. Call the nearest first.
   > "Hi, this is dispatch from {brand}. I have a {service} at {area}, {vehicle}. Can you take it,
   > what's your all-in price and how long to get there?"
   > Record each call: **No answer**, **Declined**, or **Quoted** with price and ETA.
7. **Assign**: confirm price and ETA with the driver ("{provider} can be there in about {eta}
   minutes for {price}, paid directly to them. Shall I send them?"), then press **Assign** on that
   provider. If the driver gave an email they get the provider, price, ETA and a tracking link by email;
   otherwise read the words shown on screen and press **I read it to the driver**.
8. **Follow up**: mark **On the way** when the provider leaves, **Arrived** when they're there
   (call the driver if the ETA passes), **Completed** when the job is done.

## No provider found

After the nearest providers have no answered or declined (try at least 3, or everyone within
the radius):

> "I'm sorry, I haven't been able to get a provider to you yet. I'll keep trying for the next
> 15 minutes and call you back as soon as someone confirms. If you'd rather not wait, your insurance or
> car manufacturer may include roadside help."

Keep trying for 15 minutes. If still nobody: mark **No provider found** with the reason (for
example "3 providers called, none available within 40 minutes").

## Dangerous locations

Highway shoulder, no shoulder, a bridge or tunnel, night with no lights, or the driver feels
unsafe:

> "Please stay in your car with your seatbelt on and hazard lights on. If you can't get off the
> road or feel in danger, call 911 now. I'll stay on with you until you do."

Mark the request urgent in your notes, and say so to the provider.

## Price disputes

- The quoted all-in price is what the provider agreed to on the call and what the driver saw in
  the email or what you read on the call. Read both back.
- Extra charges only for what was not in the request (for example extra tow miles, waiting more
  than 15 minutes). Ask the provider to explain before work starts.
- If the driver was charged more than the quote without a reason they agreed to: note it on the
  timeline, apologise, and pass it to the ops manager. Do not promise refunds (drivers pay
  providers directly; we don't handle the money).

## Recording outcomes

- Every call to a provider: record the outcome (it feeds response time and acceptance rate).
- Notes: one line per fact ("Driver moved to the gas station at exit 160").
- Cancelled: why ("driver got help from a friend", "fixed it themselves", "too expensive").
- The fee row for each assigned job is recorded automatically as `manual_test`; nobody is charged
  during the test campaign.

## Voicemails and missed calls

They show as **Urgent** at the top of the Inbox. Call back within 5 minutes. If no answer, leave
a voicemail with the location code (press **Location link**) and try again in 10 minutes.
