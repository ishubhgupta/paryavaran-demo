/* Journey swimlane.

   Y axis is the proposal's own ladder, Approved at the top, so the file visibly
   climbs. X axis is SEQUENCE, not time: every leg is the same width whatever its
   duration, with the day count printed inside, so a 0-day leg stays as legible
   as a 663-day one.

   Fill says whose court the file was in — ours or an authority's — which is the
   question with organisational teeth. It never judges a duration: no sanctioned
   norms are defined, so no leg is coloured late.

   Stops are pills; the climb between them is a drawn curve of the same weight,
   flowing out of one pill's centre line and into the next. A staircase of hard
   rectangles reads as a bar chart that has been cut up. A continuous line reads
   as a journey, which is what this is.

   The lane labels live in their own fixed panel. On a twelve-rung ladder the
   plot is wider than the screen, and labels that scroll away leave every bar
   unreadable. */
(function () {
  "use strict";
  var J = window.PA_JOURNEY;
  var host = document.getElementById("jchart");
  if (!J || !host) return;

  if (!(J.line || []).filter(function (p) { return p.date; }).length) {
    host.innerHTML = '<div class="empty">Nothing recorded yet.</div>';
    return;
  }

  var DAY = 864e5;
  var p2 = function (x) { return String(x).padStart(2, "0"); };
  var dmy = function (iso) {
    var d = new Date(iso);
    return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear();
  };
  var dm = function (iso) {
    var d = new Date(iso);
    return p2(d.getDate()) + "/" + p2(d.getMonth() + 1);
  };
  var days = function (a, b) { return Math.round((new Date(b) - new Date(a)) / DAY); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  };
  var plural = function (k, w) { return k + " " + w + (k === 1 ? "" : "s"); };

  /* Stage-II runs a ladder of its own after the Stage-I approval, and none of
     it has happened yet: it is the PRESCRIBED timetable projected from the day
     Stage-I was granted. Turning that into legs the chart can draw is the only
     place this file invents a line rather than being handed one — so the flag
     travels with every point, and the drawing dashes and fades whatever carries
     it. A forecast that looks like a record is worse than no forecast. */
  function projectedLine(plan, s2stages) {
    var idx = {};
    s2stages.forEach(function (st, i) { idx[st.key] = i; });
    var out = [{ date: plan[0].from, s: 0, kind: "origin", back: false,
                 handover: false, milestone: null, part: null,
                 label: s2stages[0].label, note: "Stage-I approved",
                 court: "NHAI", outcome: null, eds_id: null,
                 no_duration: true, projected: true }];
    plan.forEach(function (st, i) {
      out.push({ date: st.from, s: idx[st.rung], kind: "moved",
                 back: i > 0 && idx[st.rung] < idx[plan[i - 1].rung],
                 handover: false, milestone: null, part: null,
                 label: st.label, note: st.label, court: st.court,
                 outcome: null, eds_id: null, projected: true });
    });
    return out;
  }

  /* Which chart is on screen. Re-entrant: every piece of state below is
     computed inside, so switching view is a redraw rather than a patch. */
  var VIEWS = { s1: 0, dfl: 1, nfl: 2 };
  var view = "s1";
  var lastShown = 0;

  function draw() {
    var S2 = J.stage2;
    var proj = view !== "s1";
    var stages = proj ? S2.stages : (J.stages || []);
    var n = stages.length;
    var line = proj
      ? projectedLine(view === "nfl" ? S2.nfl : S2.dfl, stages)
      : (J.line || []).filter(function (p) { return p.date; });
    var eds = proj ? [] : (J.eds || []);
    /* The parts this clearance is applied for in. Empty on Forest and Wildlife,
       which run one application end to end. An Environment Clearance is two
       applications under two proposal numbers, and drawing them as one unbroken
       chain leaves a granted ToR looking like a file stalled a third of the way
       up a ladder whose upper rungs belong to an application not yet made. */
    var phases = proj ? [] : (J.phases || []);

  /* Merge consecutive events on the same rung into one occupancy leg. What a
     reader means by "the file was at the IRO" is the stretch it sat there, not
     each individual note against it. */
  var legs = [];
  line.forEach(function (p) {
    var last = legs[legs.length - 1];
    if (last && last.s === p.s && !p.no_duration) {
      last.to = p.date; last.n++; last.events.push(p); return;
    }
    legs.push({ s: p.s, from: p.date, to: p.date, n: 1, kind: p.kind,
                back: p.back, court: p.court, label: p.label, outcome: p.outcome,
                /* Carried from the event that OPENED the leg: whether the file
                   came down because a part was granted rather than because
                   somebody objected. */
                handover: !!p.handover, milestone: p.milestone || null,
                noDuration: !!p.no_duration, events: [p] });
  });

  /* An ENDED proposal stops accruing: the last leg is capped at the closing
     date, not run to today, or a dead file goes on showing delay against a desk
     with nothing left to do. */
  var lastEvent = line[line.length - 1];
  var TOP = n - 1;
  var approved = legs[legs.length - 1].s === TOP;
  /* A projection is "ended" only in the sense that it stops at the last
     prescribed date rather than running to today — nothing about it has
     happened, so the final tab says DUE, not Approved. */
  var ended = proj || lastEvent.kind === "ended" || approved;
  var today = new Date().toISOString().slice(0, 10);
  var tail = ended ? legs[legs.length - 1].to : today;
  legs.forEach(function (g, i) {
    g.end = i === legs.length - 1 ? tail : legs[i + 1].from;
    g.days = g.noDuration ? null : Math.max(0, days(g.from, g.end));
    g.open = !ended && i === legs.length - 1;
    // the final landing on the top rung is the outcome, not a duration
    g.isApproval = approved && i === legs.length - 1 && g.s === TOP;
  });

  /* Colour is the DIRECTION the file arrived from — green if it climbed to get
     here, red if it was sent back down. Whose court it is in was the old rule,
     but that is already legible off the Y axis (User Agency is the only desk of
     ours on either ladder), so direction is the reading that adds something:
     the red blocks are the time a setback cost. */
  legs.forEach(function (g, i) {
    g.up = i === 0 ? null : g.s > legs[i - 1].s;
    g.cameFrom = i === 0 ? null : (stages[legs[i - 1].s] || {}).label;
  });

  /* A tab is only as wide as its own label — "663d" is the longest a day count
     can be. GAP is what the connector needs after the corner: turn radius, a
     short tread, then the arrowhead, whose tip lands ON the next tab's edge. An
     arrow that stops at the right height but beside the tab leaves an L-shaped
     notch, which is what a gap here looks like. */
  var ROW = 30, PADT = 18, PADB = 32, PADR = 24, AXIS = 176;
  var BH = 18, EYE = BH / 2, RAD = 3.5, RISER = 4;
  var TURN = 4, AHL = 7, AHW = 4.6, GAP = TURN + 3 + AHL;
  var BAR = 46, ORIGIN_BAR = 42, APPROVED_BAR = 74;

  /* The tab says "Approved" and nothing more. The total the file took is the
     headline fact, but it belongs in the header beside the filing date, where a
     reader looks for it — spelling it out on the bar as well made the terminal
     tab three times the width of every other one for a number already stated
     above the chart. */
  var xs = [], acc = 3;
  legs.forEach(function (g) {
    g.bw = g.noDuration ? ORIGIN_BAR : g.isApproval ? APPROVED_BAR : BAR;
    xs.push(acc);
    acc += g.bw + GAP;
  });

  /* The parts divide the chart VERTICALLY, so the caption strip is a band along
     the top rather than a gap opened between rungs. The two applications run one
     after the other in time — ToR, then months of our own drafting, then the
     clearance — and the ladder is the same nine rungs for both. Splitting the
     rungs instead read as two halves of a single climb and put the handover, the
     very thing that separates the applications, on the wrong side of the line. */
  var BANDH = phases.length ? 19 : 0;

  var PW = acc - GAP + PADR;
  var H = PADT + BANDH + n * ROW + PADB;
  var y = function (s) { return PADT + BANDH + (n - 1 - s) * ROW + ROW / 2; };
  var current = legs[legs.length - 1].s;

  var UP = "#5aa87f", DOWN = "#b8384f", DONE = "#2f7d55";
  var INK = "#1b241f", MUTE = "#98a096";
  /* A descent nobody objected to is not a setback, so it must not wear the
     colour that means one. Slate reads as "the file moved and nothing went
     wrong" — which for a granted ToR is the whole point. */
  var HAND = "#6b8496";

  // ── the fixed label panel ────────────────────────────────────────────────
  var ax = ['<svg width="' + AXIS + '" height="' + H + '" class="jaxis" ' +
            'font-family="Inter,system-ui,sans-serif">'];
  stages.forEach(function (st, s) {
    var yy = y(s), on = s === current;
    ax.push('<text x="' + (AXIS - 16) + '" y="' + (yy + 4) +
            '" text-anchor="end" font-size="11.5" letter-spacing=".1" fill="' +
            (on ? INK : "#6b756c") + '"' + (on ? ' font-weight="650"' : '') +
            ">" + esc(st.label) + "</text>");
  });
  ax.push('<line x1="' + (AXIS - 0.5) + '" y1="' + (PADT - 4) + '" x2="' +
          (AXIS - 0.5) + '" y2="' + (H - PADB + 6) +
          '" stroke="#e3e0d6" stroke-width="1"/>');
  ax.push("</svg>");

  // ── the plot ─────────────────────────────────────────────────────────────
  /* No width attribute and no viewBox: the plot stretches to whatever the panel
     gives it and only scrolls once the journey outgrows that. A viewBox would
     scale the drawing to fit instead, shrinking a short journey's tabs. The
     rules are then drawn to 100%, so they run the full panel rather than
     stopping where the file happens to have got to. */
  var svg = ['<svg height="' + H + '" class="jsvg" style="width:100%;min-width:' +
             PW + 'px" font-family="Inter,system-ui,sans-serif">'];

  /* Where each part starts and stops along the journey. A leg carries the part
     it belongs to; a run of legs sharing one is a part's span. Spans are taken
     from the legs rather than from the ladder because the same rung can serve
     both applications — the User Agency lane is ours in Part A/B and ours again
     in Part C. */
  var spans = [];
  if (phases.length) {
    legs.forEach(function (g, i) {
      var pi = g.events[0] && g.events[0].part;
      if (pi == null) return;
      var last = spans[spans.length - 1];
      if (last && last.p === pi) { last.i1 = i; return; }
      spans.push({ p: pi, i0: i, i1: i });
    });
    spans.forEach(function (sp) {
      sp.x0 = xs[sp.i0] - 3;
      sp.x1 = xs[sp.i1] + legs[sp.i1].bw + 3;
    });
    /* The last part runs to the right-hand edge: a part in progress has no end
       yet, and stopping its band at the final bar would draw a boundary where
       nothing has happened. */
    if (spans.length) spans[spans.length - 1].open = true;
  }

  /* The band each part occupies, washed in behind everything else so the grid
     and the current-row highlight sit on top of it rather than under it. */
  spans.forEach(function (sp, k) {
    if (!(k % 2)) return;
    /* An open band is given the full width and left to run off the right edge,
       where the SVG viewport clips it. Any finite number would stop short of
       the panel edge on a wide screen and draw a boundary that is not there. */
    svg.push('<rect x="' + sp.x0 + '" y="' + (PADT + BANDH - 6) +
             '" width="' + (sp.open ? "100%" : (sp.x1 - sp.x0)) +
             '" height="' + (H - PADB - PADT - BANDH + 10) + '" fill="#f3f2ec"/>');
  });

  // hairline rules, not filled bands: the tabs carry the ink, the grid recedes
  stages.forEach(function (st, s) {
    var yy = y(s), on = s === current;
    if (on) {
      svg.push('<rect x="0" y="' + (yy - ROW / 2 + 2) + '" width="100%" height="' +
               (ROW - 4) + '" fill="#f1f4f1"/>');
    }
    svg.push('<line x1="0" y1="' + yy + '" x2="100%" y2="' + yy +
             '" stroke="#e7e5dd" stroke-width="1"/>');
  });

  /* One rule per boundary between parts, floor to ceiling. Dashed and darker
     than the grid, because it is not another step in the journey — it is where
     one application ends and a separate one, under its own proposal number,
     begins. Plus a caption naming each part, and for a part already granted,
     what granting it means. */
  spans.forEach(function (sp, k) {
    var b = phases[sp.p] || {};
    if (k) {
      svg.push('<line x1="' + sp.x0 + '" y1="' + (PADT + BANDH - 6) + '" x2="' +
               sp.x0 + '" y2="' + (H - PADB + 4) +
               '" stroke="#b9c1b6" stroke-width="1.2" stroke-dasharray="4 4"/>');
    }
    var done = !!b.done;
    svg.push('<text x="' + (sp.x0 + 4) + '" y="' + (PADT + 8) +
             '" font-size="8.5" letter-spacing=".7" font-weight="700" fill="' +
             (done ? "#3f7d5c" : "#a3aca0") + '">' +
             esc((b.label || "").toUpperCase()) + "</text>");
  });

  /* Risers first, so every tab is drawn over the line that feeds it and the
     join is hidden. Each one climbs (or drops) to the next rung's centre line,
     rounds the corner, and drives an arrowhead into that tab's left edge — so
     the path is continuous tab to tab with nothing left open between them. */
  legs.forEach(function (g, i) {
    if (i === legs.length - 1) return;
    var y1 = y(g.s), y2 = y(legs[i + 1].s), up = legs[i + 1].s > g.s;
    var xa = xs[i] + g.bw - 2, xb = xs[i + 1];
    var col = up ? UP : (legs[i + 1].handover ? HAND : DOWN);
    svg.push('<path d="M' + xa + " " + y1 + "V" + (y2 + (up ? TURN : -TURN)) +
             "Q" + xa + " " + y2 + " " + (xa + TURN) + " " + y2 +
             "H" + (xb - AHL) + '" fill="none" stroke="' + col +
             '" stroke-width="' + RISER + '" stroke-linecap="butt"/>');
    svg.push('<path d="M' + (xb - AHL) + " " + (y2 - AHW) + "L" + xb + " " + y2 +
             "L" + (xb - AHL) + " " + (y2 + AHW) + 'Z" fill="' + col + '"/>');
  });

  legs.forEach(function (g, i) {
    var yy = y(g.s), x0 = xs[i], w = g.bw;
    var fill = g.isApproval ? DONE : g.up === null ? "#c9c4b4"
             : g.up ? UP : g.handover ? HAND : DOWN;
    g.x0 = x0; g.cy = yy;

    /* Nothing on a projected chart has happened. Hollow tabs — the colour as an
       outline over the paper rather than a solid fill — say that at a glance,
       and say it in a way no legend is needed to decode: a filled bar is time
       somebody spent, an outlined one is time somebody is allowed. */
    svg.push('<g class="jleg' + (proj ? " proj" : "") + '" data-i="' + i + '">');
    if (g.noDuration) {
      svg.push('<rect class="pill" x="' + x0 + '" y="' + (yy - EYE) + '" width="' + w +
               '" height="' + BH + '" rx="' + RAD + '" fill="' +
               (proj ? "#faf9f5" : fill) + '"' +
               (proj ? ' stroke="' + fill + '" stroke-width="1.4"' +
                       ' stroke-dasharray="3 2.4"' : "") + "/>");
      svg.push('<text x="' + (x0 + w / 2) + '" y="' + (yy + 3.5) +
               '" text-anchor="middle" font-size="9" letter-spacing=".3" ' +
               'fill="' + (proj ? "#6b756c" : "#fff") +
               '" pointer-events="none">' + (proj ? "granted" : "filed") +
               "</text>");
    } else {
      svg.push('<rect class="pill" x="' + x0 + '" y="' + (yy - EYE) + '" width="' + w +
               '" height="' + BH + '" rx="' + RAD + '" fill="' +
               (proj ? "#faf9f5" : fill) + '"' +
               (proj ? ' stroke="' + fill + '" stroke-width="1.4"' +
                       ' stroke-dasharray="3 2.4"' : "") + "/>");
      if (g.open) {
        svg.push('<rect x="' + (x0 - 2.5) + '" y="' + (yy - EYE - 2.5) + '" width="' +
                 (w + 5) + '" height="' + (BH + 5) + '" rx="' + (RAD + 2) +
                 '" fill="none" stroke="' + INK +
                 '" stroke-width="1.4" stroke-dasharray="2.5 3.5" opacity=".45"/>');
      }
      svg.push('<text x="' + (x0 + w / 2) + '" y="' + (yy + 3.8) +
               '" text-anchor="middle" font-size="' + (g.isApproval ? "10" : "10.5") +
               '" font-weight="650" letter-spacing=".1" fill="' +
               (proj ? fill : "#fff") + '" pointer-events="none">' +
               (g.isApproval ? (proj ? "Stage-II due" : "Approved")
                             : g.days + "d") + "</text>");
    }
    svg.push("</g>");
  });

  /* The grant itself, called by name at the desk that gave it.

     Without this the only trace of a granted ToR is an arrow pointing down —
     and downwards is the direction a rejected file also travels. The chip sits
     on the rung the file LEFT, at the moment it left, because that is where the
     decision was taken; the bar below it is the months of our own work that
     followed, which is a different fact. */
  legs.forEach(function (g, i) {
    if (!g.milestone || !i) return;
    var from = legs[i - 1], tx = esc(g.milestone);
    var w = tx.length * 4.9 + 15, x0 = xs[i - 1] + from.bw + 5;
    var yy = y(from.s) - 13;
    svg.push('<g pointer-events="none">');
    svg.push('<rect x="' + x0 + '" y="' + (yy - 7.5) + '" width="' + w +
             '" height="15" rx="7.5" fill="' + DONE + '"/>');
    svg.push('<text x="' + (x0 + w / 2) + '" y="' + (yy + 3.6) +
             '" text-anchor="middle" font-size="8.8" font-weight="700" ' +
             'letter-spacing=".25" fill="#fff">' + tx + "</text>");
    svg.push("</g>");
  });

  /* One date per change of date. Consecutive same-day hops printed the same
     string four times over and the strip turned into noise. */
  var prev = null;
  legs.forEach(function (g, i) {
    if (g.noDuration || g.from === prev) return;
    prev = g.from;
    svg.push('<text x="' + (g.x0 + g.bw / 2) + '" y="' + (H - 12) +
             '" text-anchor="middle" font-size="9.5" letter-spacing=".2" fill="' +
             MUTE + '" pointer-events="none">' + dm(g.from) + "</text>");
  });

  /* Two pins per round, not one.

     A round is two separate things happening on two different days at two
     different desks: a query goes down, and later an answer comes back. One pin
     carrying both had to describe an answer that, at the moment it is drawn,
     may not exist — and on an open round it said nothing about what is being
     waited for. So the amber pin marks the objection and shows only that; the
     blue one marks the reply and shows the query with its answer beside it.

     Absence is then the signal: an amber pin with no blue one after it is a
     question nobody has answered yet. */
  var AMBER = "#d99a10", BLUE = "#2f7fb5";
  var legOfEds = {}, legOfReply = {};
  legs.forEach(function (g, i) {
    g.events.forEach(function (p) {
      if (p.eds_id == null) return;
      if (p.kind === "eds_raised" && legOfEds[p.eds_id] == null) legOfEds[p.eds_id] = i;
      if (p.kind === "eds_answered" && legOfReply[p.eds_id] == null) legOfReply[p.eds_id] = i;
    });
  });

  // Several pins can land on one tab; spread them so none hides another.
  var pinsOn = {};
  function place(li, id, kind, m) {
    var g = legs[li];
    if (!g) return null;
    var n = (pinsOn[li] = (pinsOn[li] || 0) + 1);
    return { g: g, cx: g.x0 + g.bw / 2 + (n - 1) * 12, cy: g.cy - EYE, id: id,
             kind: kind, m: m };
  }

  var pins = [];
  eds.forEach(function (m) {
    var dip = legOfEds[m.id];
    if (dip === undefined) {
      for (var k = 0; k < legs.length; k++) { if (legs[k].from <= m.date) dip = k; }
    }
    if (dip !== null && dip !== undefined) {
      // the raise is pinned to the desk that RAISED it, the tab before the dip
      var p = place(dip > 0 ? dip - 1 : dip, m.id, "raised", m);
      if (p) pins.push(p);
    }
    /* The reply is pinned to the desk that WROTE it: the leg the objection
       LANDED on, where the recipient sat holding the file until it answered.
       Not the eds_answered leg — that is the raiser getting its file back — and
       not "the leg before" it either, because a movement can fall between the
       two on the same day, which put the pin on a desk that never saw the
       query. Anchoring on the landing leg needs nothing to be adjacent. */
    if (m.status === "answered" && dip !== null && dip !== undefined) {
      var q = place(dip, m.id, "answered", m);
      if (q) pins.push(q);
    }
  });

  pins.forEach(function (p) {
    var r = 4.5, col = p.kind === "answered" ? BLUE : AMBER;
    var dia = function (k) {
      return "M" + p.cx + " " + (p.cy - k) + "L" + (p.cx + k) + " " + p.cy + "L" +
             p.cx + " " + (p.cy + k) + "L" + (p.cx - k) + " " + p.cy + "Z";
    };
    svg.push('<g class="edsmark" data-id="' + p.id + '" data-kind="' + p.kind + '">');
    svg.push('<circle cx="' + p.cx + '" cy="' + p.cy + '" r="9" fill="transparent"/>');
    // a white halo, or a pin vanishes into a tab of a similar colour
    svg.push('<path d="' + dia(r + 2) + '" fill="#fff"/>');
    svg.push('<path d="' + dia(r) + '" fill="' +
             (p.kind === "answered" ? col : "#fffdf7") + '" stroke="' + col +
             '" stroke-width="2" stroke-linejoin="round"/>');
    if (p.m.count > 1) {
      svg.push('<text x="' + (p.cx + 8.5) + '" y="' + (p.cy + 3.5) +
               '" font-size="9.5" font-weight="700" fill="' + col +
               '" pointer-events="none">&#215;' + p.m.count + "</text>");
    }
    svg.push("</g>");
  });

  svg.push("</svg>");

  /* The Stage-II switch, and the banner that must travel with it.
     "Approved" on a Forest file means STAGE-I — approval in principle. The
     diversion is not usable until Stage-II issues, and the chain between them
     was simply not on this page. */
  var head = "";
  if (J.stage2) {
    head = '<div class="s2bar">' +
      '<div class="s2tabs">' +
      '<button type="button" class="s2t' + (view === "s1" ? " on" : "") +
      '" data-view="s1">Stage-I &middot; recorded</button>' +
      '<button type="button" class="s2t' + (view === "dfl" ? " on" : "") +
      '" data-view="dfl">Stage-II &middot; degraded forest land</button>' +
      '<button type="button" class="s2t' + (view === "nfl" ? " on" : "") +
      '" data-view="nfl">Stage-II &middot; non-forest land</button></div>';
    if (proj) {
      var last = (view === "nfl" ? J.stage2.nfl : J.stage2.dfl);
      head += '<div class="s2note"><b>Prescribed timetable, not a record.</b> ' +
        "Nothing below has happened: these are the norms the process allows, " +
        "run on from the Stage-I approval of " + dmy(J.stage2.granted_on) +
        ". On these norms Stage-II falls due <b>" +
        dmy(last[last.length - 1].to) + "</b> &mdash; " +
        plural(days(J.stage2.granted_on, last[last.length - 1].to), "day") +
        " after Stage-I." +
        (view === "nfl"
          ? " Non-forest compensatory land must be mutated to protected forest " +
            "first, which adds three months."
          : " Degraded forest land needs no mutation.") + "</div>";
    }
    head += "</div>";
  }

  host.innerHTML = head +
    '<div class="jgrid' + (proj ? " proj" : "") + '">' + ax.join("") +
    '<div class="jplot">' + svg.join("") + "</div></div>";

  /* Left to right, every time. The switch is a change of subject, not a
     filter, and sliding says so in a way a swap cannot. */
  var grid = host.querySelector(".jgrid");
  if (grid && VIEWS[view] !== lastShown) {
    grid.classList.add(VIEWS[view] > lastShown ? "slide-in" : "slide-back");
  }
  lastShown = VIEWS[view];

  Array.prototype.forEach.call(host.querySelectorAll(".s2t"), function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.view === view) return;
      view = b.dataset.view;
      draw();
    });
  });

  // ── tooltips ──────────────────────────────────────────────────────────────
  var tip = document.querySelector(".jtip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "jtip";
    document.body.appendChild(tip);
  }

  function show(html, el) {
    tip.innerHTML = html;
    tip.classList.add("on");
    var r = el.getBoundingClientRect();
    var w = tip.offsetWidth || 320, h = tip.offsetHeight || 120;
    var left = Math.max(10, Math.min(window.innerWidth - w - 10,
                                     r.left + r.width / 2 - w / 2));
    var top = r.top - h - 10;
    if (top < 8) top = r.bottom + 10;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function hide() { tip.classList.remove("on"); }

  var KIND = {
    submitted: "Filed with the first authority desk",
    moved: "Moved here",
    eds_raised: "An objection sent the file here",
    eds_forwarded: "The objection was forwarded here",
    eds_answered: "Answered — back to the desk that asked",
    override: "Position corrected by hand",
    ended: "The proposal ended here",
    origin: "With us before filing",
  };

  function legTip(g) {
    var h = "<b>" + esc(stages[g.s] ? stages[g.s].label : "") + "</b>";
    h += '<div class="sub">' +
         (g.isApproval ? "Cleared" : g.court === "NHAI" ? "Our court" : "With the authority") +
         "</div>";
    /* A red bar is the one thing on this chart a reader will demand an
       explanation for, and only some drops are objections — the rest are the
       levies loop or ordinary re-routing. Say which, every time, rather than
       leaving the colour to imply a setback that may not have happened. */
    if (g.up === false) {
      var e0 = g.events[0] || {};
      var why;
      if (g.milestone) {
        /* The best outcome this part has, and it arrives as a descent. Say so
           first, before the reader reads the direction as a setback. */
        why = "<b>" + esc(g.milestone) + ".</b> That part of the clearance is " +
              "finished, so the file comes back to us to prepare the next one.";
      } else if (e0.kind === "eds_raised") why = "An objection sent the file back here.";
      else if (e0.kind === "eds_forwarded") why = "The objection was forwarded down to here.";
      else if (e0.note) why = esc(e0.note) + " &mdash; not an objection.";
      else why = "PARIVESH records no reason for this step.";
      h += '<div class="why"><b>Came down from ' + esc(g.cameFrom) + "</b><br>" +
           why + "</div>";
    }
    h += '<div class="sepline"></div>';
    if (g.noDuration) {
      return h + "Filed " + dmy(g.from) +
             '<div class="hopline">The journey starts here. How long the file was ' +
             "being prepared before this is not recorded.</div>";
    }
    if (g.isApproval) {
      // named by the ladder, not hardcoded: Forest ends in a diversion order,
      // Wildlife in a permit, Environment in a grant
      h += esc(stages[g.s] ? stages[g.s].label : "Cleared") + " " + dmy(g.from) +
           '<div class="hopline">' + plural(days(legs[0].from, g.from), "day") +
           " from the day the file became ours (" + dmy(legs[0].from) + ")." +
           "</div><div class=\"hopline\">The clock stops here.</div>";
    } else {
      h += dmy(g.from) + " &rarr; " + (g.open ? "now" : dmy(g.end)) +
           " &middot; <b>" + plural(g.days, "day") + "</b>";
      if (g.open) h += '<div class="hopline">Still here — the count is still running.</div>';
    }
    var seen = {};
    g.events.forEach(function (p) {
      var what = p.note || KIND[p.kind] || p.kind;
      if (seen[what]) return;
      seen[what] = 1;
      h += '<div class="hopline">&bull; ' + esc(what) + "</div>";
    });
    // Anything bolted on by the page — remarks, in the demo. Kept as a hook so
    // the chart itself stays about the journey and nothing else.
    var hooks = window.PA_JOURNEY_HOOKS || {};
    if (hooks.legExtra) h += hooks.legExtra(g);
    return h;
  }

  /* The amber pin: what was ASKED, and nothing else. On the day it is drawn the
     answer does not exist yet, and on an open round it still does not — so
     showing a reply slot here would either be blank or would report a fact from
     the future. */
  function raisedTip(m) {
    var h = "<b>" + esc(m.raised_by) + "</b> raised " +
            (m.count === 1 ? "an objection" : m.count + " objections");
    h += '<div class="sub">' + dmy(m.date) + " &middot; " +
         (m.status === "answered" ? "answered later" : "still unanswered") + "</div>";
    (m.chain || []).forEach(function (c) {
      h += '<div class="hopline">&darr; sent to ' + esc(c.rung) + " &middot; " +
           dmy(c.on) + "</div>";
    });
    h += '<div class="sepline"></div>';
    (m.objections || []).forEach(function (o, i) {
      h += "<div>" + (m.count > 1 ? (i + 1) + ". " : "") + esc(o.q) + "</div>";
    });
    return h + '<div class="sub" style="margin-top:6px">' +
           (m.status === "answered"
              ? "The blue pin further along carries the reply."
              : "No reply recorded yet.") + "</div>";
  }

  /* The blue pin: the answer, shown BESIDE the question it answers. A reply on
     its own is unreadable — nobody remembers which of five queries it settles. */
  function answeredTip(m) {
    var h = "<b>Answered</b> &middot; back to " + esc(m.raised_by);
    h += '<div class="sub">' + (m.answered_on ? dmy(m.answered_on) + " &middot; " : "") +
         (m.turnaround !== null && m.turnaround !== undefined
            ? "took " + plural(m.turnaround, "day") : "") + "</div>";
    h += '<div class="sepline"></div>';
    (m.objections || []).forEach(function (o, i) {
      h += '<div class="qa"><div class="q">' + (m.count > 1 ? (i + 1) + ". " : "") +
           esc(o.q) + "</div>";
      h += '<div class="a">' + (o.reply
           ? esc(o.reply) + (o.on ? '<span class="on"> &middot; ' + dmy(o.on) + "</span>" : "")
           : "no reply recorded") + "</div></div>";
    });
    return h + '<div class="sub" style="margin-top:6px">Click to jump to it below</div>';
  }

  Array.prototype.forEach.call(host.querySelectorAll(".jleg"), function (el) {
    var g = legs[+el.dataset.i];
    if (!g) return;
    el.addEventListener("mouseenter", function () { show(legTip(g), el); });
    el.addEventListener("mouseleave", hide);
    el.addEventListener("click", function (e) {
      var hooks = window.PA_JOURNEY_HOOKS || {};
      if (!hooks.onLegClick) return;
      e.stopPropagation();
      hide();
      hooks.onLegClick(g, el, stages[g.s] ? stages[g.s].label : "");
    });
  });

  Array.prototype.forEach.call(host.querySelectorAll(".edsmark"), function (el) {
    var m = eds.filter(function (e) { return String(e.id) === el.dataset.id; })[0];
    if (!m) return;
    var tipFor = el.dataset.kind === "answered" ? answeredTip : raisedTip;
    el.addEventListener("mouseenter", function () { show(tipFor(m), el); });
    el.addEventListener("mouseleave", hide);
    el.addEventListener("click", function () {
      var t = document.getElementById("eds-" + m.id);
      if (!t) return;
      hide();
      t.scrollIntoView({ behavior: "smooth", block: "center" });
      t.classList.add("flash");
      setTimeout(function () { t.classList.remove("flash"); }, 1600);
    });
  });

  var plot = host.querySelector(".jplot");
  if (plot) plot.addEventListener("scroll", hide, { passive: true });
  }

  window.addEventListener("scroll", function () {
    var t = document.querySelector(".jtip");
    if (t) t.classList.remove("on");
  }, { passive: true });

  draw();
})();
