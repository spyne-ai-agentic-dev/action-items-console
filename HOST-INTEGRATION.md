# Host integration — Action Items iframe ⇄ converse-ai URL sync

**Audience:** converse-ai (spyne-console-microfrontends) devs.
**Symptom being fixed:** on `uat-console.spyne.xyz/converse-ai/action-items?...&serviceType=service`
the browser URL never follows the Sales/Service toggle, and `serviceType=service` on the host URL
opens the console on Sales anyway.

**Why the console can't fix this alone:** the address bar belongs to the HOST page. The console is
a cross-origin iframe — it cannot read the host URL, and it cannot write it. Browsers forbid both.
The console already does its half (it emits/accepts postMessages, below); the host must do these
two small things.

---

## 1. Forward `serviceType` into the iframe src

Today the host URL can carry `?serviceType=service` while the iframe src omits it — the console
then defaults to Sales. When building the iframe URL, pass it through:

```ts
const st = new URLSearchParams(window.location.search).get("serviceType") ?? "sales";
const src = `https://<console-host>/?env=${env}&enterpriseId=${enterpriseId}` +
            `&teamId=${teamId}&token=${token}&serviceType=${st}` +
            (userId ? `&userId=${userId}&userEmail=${encodeURIComponent(userEmail)}` : "");
```

> Also pass `userId`/`userEmail` of the logged-in user if available — the console records the
> resolver and auto-assigns them on resolve. (The bearer token payload carries no user identity,
> so the URL is the only channel for it.)

## 2. Sync the host URL when the toggle changes

The console posts a message on every Sales/Service switch. Add one listener on the host page:

```ts
useEffect(() => {
  const onMsg = (e: MessageEvent) => {
    const d = e.data;
    if (d?.source !== "action-items-console" || d.type !== "serviceTypeChange") return;
    const url = new URL(window.location.href);
    url.searchParams.set("serviceType", d.serviceType);          // "sales" | "service"
    window.history.replaceState(null, "", url.toString());       // address bar now follows the toggle
  };
  window.addEventListener("message", onMsg);
  return () => window.removeEventListener("message", onMsg);
}, []);
```

Optionally restrict by origin: `if (e.origin !== "https://<console-host>") return;`

## 3. (Optional) Drive the console from the host

To switch the console's department programmatically (host-side tabs, back/forward handling):

```ts
iframeRef.current?.contentWindow?.postMessage(
  { type: "setServiceType", serviceType: "service" }, "https://<console-host>");
```

---

## Message contract (console side, already live)

| Direction | Message | When |
|---|---|---|
| console → host | `{ source: "action-items-console", type: "ready", serviceType }` | once on mount |
| console → host | `{ source: "action-items-console", type: "serviceTypeChange", serviceType }` | every toggle switch |
| host → console | `{ type: "setServiceType", serviceType: "sales" \| "service" }` | any time |

## Verify

Open `https://<console-host>/host-test.html?serviceType=service` — a reference host page that
implements exactly steps 1–2. Its URL bar (top strip) follows the toggle both ways. Your
integration should behave identically.
