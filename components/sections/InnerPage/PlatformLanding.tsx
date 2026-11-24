import Link from "next/link";

type Card = { title: string; text: string; points?: string[] };

export default function PlatformLanding({
  eyebrow,
  title,
  lead,
  cards,
  notice,
  primaryHref = "/register",
  primaryLabel = "Open account",
}: {
  eyebrow: string;
  title: string;
  lead: string;
  cards: Card[];
  notice: string;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  return (
    <>
      <section className="pdtop" style={{ paddingTop: 70, paddingBottom: 50 }}>
        <div className="container">
          <div className="sec-title withtext text-center" style={{ maxWidth: 820, margin: "0 auto" }}>
            <div className="sub-title">
              <h4>{eyebrow}</h4>
            </div>
            <h2>{title}</h2>
            <div className="text">
              <p style={{ fontSize: 17, lineHeight: 1.7 }}>{lead}</p>
            </div>
            <div className="btn-box" style={{ marginTop: 22 }}>
              <Link className="btn-one" href={primaryHref}>
                <span className="txt">{primaryLabel}</span>
                <i className="icon-right-arrow"></i>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 70 }}>
        <div className="container">
          <div className="row g-4">
            {cards.map((card) => (
              <div className="col-xl-4 col-lg-6" key={card.title}>
                <article
                  style={{
                    height: "100%",
                    background: "#ffffff",
                    border: "1px solid #e4ebe4",
                    borderRadius: 18,
                    padding: 26,
                    boxShadow: "0 14px 40px rgba(5,21,9,0.06)",
                    display: "grid",
                    gap: 12,
                    alignContent: "start",
                  }}
                >
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#051509", margin: 0 }}>{card.title}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "#5d6b5f" }}>{card.text}</p>
                  {card.points && (
                    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5, color: "#43584a" }}>
                      {card.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: 34,
              padding: "14px 18px",
              borderRadius: 12,
              background: "#f2f8f2",
              border: "1px solid #e0ece0",
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "#43584a",
            }}
          >
            {notice}
          </p>
        </div>
      </section>
    </>
  );
}
