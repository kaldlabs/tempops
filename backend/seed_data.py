"""
Seed script: creates demo users with full project → task → dependency flows.
Run: python seed_data.py

Accounts seeded:
  admin  / adminpass123  (role: admin)
  demo   / demopass123   (role: user)  ← full sample project
  user   / userpass123   (role: user)
"""
import asyncio
import uuid
from datetime import date, timedelta

from app.database import async_session_factory, init_db
from app.models import Dependency, Project, Task, User
from app.utils.security import hash_password


async def seed():
    """Populate the database with realistic Gantt chart sample data."""
    await init_db()

    async with async_session_factory() as session:

        # ── Users ──────────────────────────────────────────────────────────────
        admin_id = str(uuid.uuid4())
        session.add(User(
            id=admin_id,
            username="admin",
            email="admin@tempops.dev",
            hashed_password=hash_password("adminpass123"),
            role="admin",
        ))

        demo_id = str(uuid.uuid4())
        session.add(User(
            id=demo_id,
            username="demo",
            email="demo@tempops.dev",
            hashed_password=hash_password("demopass123"),
            role="user",
        ))

        regular_id = str(uuid.uuid4())
        session.add(User(
            id=regular_id,
            username="user",
            email="user@tempops.dev",
            hashed_password=hash_password("userpass123"),
            role="user",
        ))

        today = date.today()

        # ══════════════════════════════════════════════════════════════════════
        # PROJECT 1 (admin): Q3 Platform Roadmap
        # ══════════════════════════════════════════════════════════════════════
        p1_id = str(uuid.uuid4())
        session.add(Project(
            id=p1_id,
            user_id=admin_id,
            name="Q3 Platform Roadmap",
            description="Product roadmap for Q3 2026 — Auth, Realtime, AI queue.",
        ))

        # Phase 1 – Research (done)
        ph1_id = str(uuid.uuid4())
        session.add(Task(
            id=ph1_id, project_id=p1_id,
            name="Phase 1: Research & Planning",
            start_date=today - timedelta(days=14),
            end_date=today - timedelta(days=7),
            progress=100, status="DONE", priority="M", sort_order=0,
        ))
        t1_1_id = str(uuid.uuid4())
        session.add(Task(
            id=t1_1_id, project_id=p1_id, parent_id=ph1_id,
            name="Competitive Analysis",
            start_date=today - timedelta(days=14),
            end_date=today - timedelta(days=10),
            progress=100, status="DONE", priority="M", sort_order=1, assignee_id="@alice",
        ))
        t1_2_id = str(uuid.uuid4())
        session.add(Task(
            id=t1_2_id, project_id=p1_id, parent_id=ph1_id,
            name="Stakeholder Requirements Sign-off",
            start_date=today - timedelta(days=10),
            end_date=today - timedelta(days=7),
            progress=100, status="DONE", priority="H", sort_order=2, assignee_id="@admin",
        ))

        # Phase 2 – Design (in progress)
        ph2_id = str(uuid.uuid4())
        session.add(Task(
            id=ph2_id, project_id=p1_id,
            name="Phase 2: Design & Prototyping",
            start_date=today - timedelta(days=6),
            end_date=today + timedelta(days=5),
            progress=42, status="IN_PROGRESS", priority="H", sort_order=3,
        ))
        t2_1_id = str(uuid.uuid4())
        session.add(Task(
            id=t2_1_id, project_id=p1_id, parent_id=ph2_id,
            name="Wireframing & UX Flow",
            start_date=today - timedelta(days=6),
            end_date=today - timedelta(days=1),
            progress=80, status="IN_PROGRESS", priority="H", sort_order=4, assignee_id="@alice",
        ))
        t2_2_id = str(uuid.uuid4())
        session.add(Task(
            id=t2_2_id, project_id=p1_id, parent_id=ph2_id,
            name="Hi-Fi Component Library",
            start_date=today,
            end_date=today + timedelta(days=5),
            progress=10, status="IN_PROGRESS", priority="M", sort_order=5, assignee_id="@kietdo",
        ))

        # Phase 3 – Development (todo)
        ph3_id = str(uuid.uuid4())
        session.add(Task(
            id=ph3_id, project_id=p1_id,
            name="Phase 3: Development",
            start_date=today + timedelta(days=6),
            end_date=today + timedelta(days=22),
            progress=0, status="TODO", priority="H", sort_order=6,
        ))
        t3_1_id = str(uuid.uuid4())
        session.add(Task(
            id=t3_1_id, project_id=p1_id, parent_id=ph3_id,
            name="Backend API (FastAPI)",
            start_date=today + timedelta(days=6),
            end_date=today + timedelta(days=14),
            progress=0, status="TODO", priority="H", sort_order=7, assignee_id="@kietdo",
        ))
        t3_2_id = str(uuid.uuid4())
        session.add(Task(
            id=t3_2_id, project_id=p1_id, parent_id=ph3_id,
            name="Realtime WebSocket Layer",
            start_date=today + timedelta(days=12),
            end_date=today + timedelta(days=18),
            progress=0, status="TODO", priority="H", sort_order=8, assignee_id="@system",
        ))
        t3_3_id = str(uuid.uuid4())
        session.add(Task(
            id=t3_3_id, project_id=p1_id, parent_id=ph3_id,
            name="Frontend Next.js — Gantt Chart",
            start_date=today + timedelta(days=10),
            end_date=today + timedelta(days=22),
            progress=0, status="TODO", priority="H", sort_order=9, assignee_id="@alice",
        ))

        # Phase 4 – QA (todo)
        ph4_id = str(uuid.uuid4())
        session.add(Task(
            id=ph4_id, project_id=p1_id,
            name="Phase 4: QA & Release",
            start_date=today + timedelta(days=22),
            end_date=today + timedelta(days=28),
            progress=0, status="TODO", priority="M", sort_order=10,
        ))

        # Dependencies for Project 1
        for pred, succ in [
            (ph1_id, ph2_id), (ph2_id, ph3_id), (ph3_id, ph4_id),
            (t1_2_id, t2_1_id), (t2_1_id, t2_2_id),
            (t3_1_id, t3_2_id), (t3_1_id, t3_3_id),
        ]:
            session.add(Dependency(
                id=str(uuid.uuid4()), project_id=p1_id,
                predecessor_id=pred, successor_id=succ, dependency_type="FS",
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PROJECT 2 (demo): E-Commerce Mobile App Launch
        # Full end-to-end demo flow for the "demo" user
        # ══════════════════════════════════════════════════════════════════════
        p2_id = str(uuid.uuid4())
        session.add(Project(
            id=p2_id,
            user_id=demo_id,
            name="Mobile App Launch — ShopX",
            description=(
                "Full lifecycle of a cross-platform e-commerce mobile app: "
                "Discovery → Design → Dev → QA → Launch. "
                "Use this project to explore all tempops features."
            ),
        ))

        # ── Milestone 0: Kickoff (done) ──────────────────────────────────────
        m0_id = str(uuid.uuid4())
        session.add(Task(
            id=m0_id, project_id=p2_id,
            name="🚀 Project Kickoff",
            start_date=today - timedelta(days=30),
            end_date=today - timedelta(days=29),
            progress=100, status="DONE", priority="H", sort_order=0,
        ))

        # ── Milestone 1: Discovery & Strategy (done) ─────────────────────────
        m1_id = str(uuid.uuid4())
        session.add(Task(
            id=m1_id, project_id=p2_id,
            name="Milestone 1 — Discovery & Strategy",
            description="Market research, user interviews, and go-to-market strategy.",
            start_date=today - timedelta(days=28),
            end_date=today - timedelta(days=18),
            progress=100, status="DONE", priority="H", sort_order=1,
        ))
        ta_ids = {}
        for i, (name, days_start, days_end, assignee, prio) in enumerate([
            ("User Interviews (12 sessions)",  -28, -23, "@demo",  "H"),
            ("Competitor Benchmarking",        -25, -20, "@alice", "M"),
            ("Go-to-Market Strategy Doc",      -22, -18, "@demo",  "H"),
            ("Technical Feasibility Report",   -20, -18, "@kietdo","M"),
        ]):
            tid = str(uuid.uuid4())
            ta_ids[f"m1_{i}"] = tid
            session.add(Task(
                id=tid, project_id=p2_id, parent_id=m1_id,
                name=name,
                start_date=today + timedelta(days=days_start),
                end_date=today + timedelta(days=days_end),
                progress=100, status="DONE", priority=prio,
                sort_order=2 + i, assignee_id=assignee,
            ))

        # ── Milestone 2: UX / UI Design (in progress) ────────────────────────
        m2_id = str(uuid.uuid4())
        session.add(Task(
            id=m2_id, project_id=p2_id,
            name="Milestone 2 — UX / UI Design",
            description="End-to-end design system, flows, and interactive prototypes.",
            start_date=today - timedelta(days=17),
            end_date=today + timedelta(days=5),
            progress=58, status="IN_PROGRESS", priority="H", sort_order=6,
        ))
        m2_tasks = {}
        for i, (name, ds, de, prog, status, assignee, prio) in enumerate([
            ("Information Architecture",    -17, -12, 100, "DONE",        "@alice",  "H"),
            ("Wireframes — Onboarding flow",-14, -9,  100, "DONE",        "@demo",   "H"),
            ("Wireframes — Product catalog",-11, -6,  100, "DONE",        "@demo",   "H"),
            ("Wireframes — Checkout & Pay", -8,  -3,  80,  "IN_PROGRESS", "@alice",  "H"),
            ("Hi-Fi Figma Components",      -5,   2,  45,  "IN_PROGRESS", "@demo",   "M"),
            ("Design System Tokens Export",  1,   5,  0,   "TODO",        "@alice",  "M"),
        ]):
            tid = str(uuid.uuid4())
            m2_tasks[f"t{i}"] = tid
            session.add(Task(
                id=tid, project_id=p2_id, parent_id=m2_id,
                name=name,
                start_date=today + timedelta(days=ds),
                end_date=today + timedelta(days=de),
                progress=prog, status=status, priority=prio,
                sort_order=7 + i, assignee_id=assignee,
            ))

        # ── Milestone 3: Development (todo / partial) ────────────────────────
        m3_id = str(uuid.uuid4())
        session.add(Task(
            id=m3_id, project_id=p2_id,
            name="Milestone 3 — Development",
            description="React Native app, backend APIs, payment gateway integration.",
            start_date=today + timedelta(days=6),
            end_date=today + timedelta(days=36),
            progress=0, status="TODO", priority="H", sort_order=13,
        ))
        m3_tasks = {}
        for i, (name, ds, de, assignee, prio) in enumerate([
            ("Project scaffolding & CI/CD",      6,  9,  "@kietdo", "H"),
            ("Auth: Sign-up / Login screens",     7, 13,  "@demo",   "H"),
            ("Product catalog & search",          9, 18,  "@demo",   "H"),
            ("Shopping cart & state mgmt",       15, 22,  "@alice",  "H"),
            ("Stripe payment integration",       20, 28,  "@kietdo", "H"),
            ("Order tracking & push notifs",     25, 33,  "@demo",   "M"),
            ("Performance optimisation (FPS)",   30, 36,  "@kietdo", "M"),
        ]):
            tid = str(uuid.uuid4())
            m3_tasks[f"t{i}"] = tid
            session.add(Task(
                id=tid, project_id=p2_id, parent_id=m3_id,
                name=name,
                start_date=today + timedelta(days=ds),
                end_date=today + timedelta(days=de),
                progress=0, status="TODO", priority=prio,
                sort_order=14 + i, assignee_id=assignee,
            ))

        # ── Milestone 4: QA & Beta (todo) ─────────────────────────────────────
        m4_id = str(uuid.uuid4())
        session.add(Task(
            id=m4_id, project_id=p2_id,
            name="Milestone 4 — QA & Beta Testing",
            description="Device matrix testing, performance benchmarks, crash triage.",
            start_date=today + timedelta(days=35),
            end_date=today + timedelta(days=48),
            progress=0, status="TODO", priority="H", sort_order=21,
        ))
        m4_tasks = {}
        for i, (name, ds, de, prio) in enumerate([
            ("Unit & integration tests",     35, 40, "H"),
            ("E2E tests (Detox)",            38, 44, "H"),
            ("Beta TestFlight / Play Store", 42, 48, "M"),
            ("Crash analytics review",       44, 48, "M"),
        ]):
            tid = str(uuid.uuid4())
            m4_tasks[f"t{i}"] = tid
            session.add(Task(
                id=tid, project_id=p2_id, parent_id=m4_id,
                name=name,
                start_date=today + timedelta(days=ds),
                end_date=today + timedelta(days=de),
                progress=0, status="TODO", priority=prio,
                sort_order=22 + i, assignee_id="@demo",
            ))

        # ── Milestone 5: Launch (todo) ────────────────────────────────────────
        m5_id = str(uuid.uuid4())
        session.add(Task(
            id=m5_id, project_id=p2_id,
            name="🏁 Milestone 5 — App Store Launch",
            description="Store submission, marketing push, and launch-day ops.",
            start_date=today + timedelta(days=48),
            end_date=today + timedelta(days=52),
            progress=0, status="TODO", priority="H", sort_order=26,
        ))
        for i, (name, ds, de) in enumerate([
            ("App Store Connect submission", 48, 50),
            ("Google Play submission",       48, 50),
            ("Launch press & social media",  50, 52),
            ("Day-1 monitoring & hotfix",    52, 52),
        ]):
            session.add(Task(
                id=str(uuid.uuid4()), project_id=p2_id, parent_id=m5_id,
                name=name,
                start_date=today + timedelta(days=ds),
                end_date=today + timedelta(days=de),
                progress=0, status="TODO", priority="H",
                sort_order=27 + i, assignee_id="@demo",
            ))

        # Dependencies for Project 2
        p2_deps = [
            # Milestone chain
            (m0_id,  m1_id),
            (m1_id,  m2_id),
            (m2_id,  m3_id),
            (m3_id,  m4_id),
            (m4_id,  m5_id),
            # Inside M1
            (ta_ids["m1_0"], ta_ids["m1_2"]),
            (ta_ids["m1_1"], ta_ids["m1_2"]),
            (ta_ids["m1_2"], ta_ids["m1_3"]),
            # Inside M2
            (m2_tasks["t0"], m2_tasks["t1"]),
            (m2_tasks["t0"], m2_tasks["t2"]),
            (m2_tasks["t1"], m2_tasks["t3"]),
            (m2_tasks["t2"], m2_tasks["t3"]),
            (m2_tasks["t3"], m2_tasks["t4"]),
            (m2_tasks["t4"], m2_tasks["t5"]),
            # Inside M3
            (m3_tasks["t0"], m3_tasks["t1"]),
            (m3_tasks["t1"], m3_tasks["t2"]),
            (m3_tasks["t2"], m3_tasks["t3"]),
            (m3_tasks["t3"], m3_tasks["t4"]),
            (m3_tasks["t4"], m3_tasks["t5"]),
            (m3_tasks["t5"], m3_tasks["t6"]),
            # Inside M4
            (m4_tasks["t0"], m4_tasks["t1"]),
            (m4_tasks["t1"], m4_tasks["t2"]),
            (m4_tasks["t2"], m4_tasks["t3"]),
        ]
        for pred, succ in p2_deps:
            session.add(Dependency(
                id=str(uuid.uuid4()), project_id=p2_id,
                predecessor_id=pred, successor_id=succ, dependency_type="FS",
            ))

        await session.commit()

    print("=" * 60)
    print("✅  Seed complete!")
    print("=" * 60)
    print()
    print("👤  Accounts")
    print("    admin  / adminpass123  (role: admin)")
    print("    demo   / demopass123   (role: user)  ← FULL sample project")
    print("    user   / userpass123   (role: user)")
    print()
    print("📁  Projects")
    print(f"    [admin] Q3 Platform Roadmap  →  /projects/{p1_id}")
    print(f"    [demo]  Mobile App — ShopX   →  /projects/{p2_id}")
    print()
    print("📌  Demo project stats")
    print("    5 milestones · 25 tasks · 23 dependencies")
    print("    Spanning 30 days past → 52 days future")
    print()
    print("🌐  Frontend:  http://localhost:3000/login")
    print("🔧  Backend:   http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())
