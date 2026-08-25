import "./App.css";
import { useState } from "react";

const PAPER_PDF = "/main.pdf";
const ARXIV_URL = "https://arxiv.org/abs/0000.00000";
const CODE_URL = "https://github.com/";

const BIBTEX = `@article{li2026actionable,
  title={From Geometric Reconstruction to Actionable Scene Understanding for Embodied Manipulation: A Survey},
  author={Li, Yaze and Xie, Xinyu and Ma, Jiawei and Song, Siying and Xiao, Haihong},
  journal={arXiv preprint},
  year={2026}
}`;

function fig(name) {
  return `/figures/${name}.png`;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="copy-btn" onClick={onCopy} type="button">
      <ion-icon name={copied ? "checkmark-outline" : "copy-outline"}></ion-icon>
      {copied ? " Copied" : " Copy"}
    </button>
  );
}

function PdfFigure({ src, caption }) {
  return (
    <figure className="pdf-figure">
      <div className="pdf-frame">
        <img src={src} alt={caption || "figure"} loading="lazy" />
      </div>
      {caption && (
        <figcaption className="pdf-figure__caption content is-size-6 has-text-left">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function SectionTitle({ children }) {
  return <p className="title is-3 mt-6 has-text-centered section-title">{children}</p>;
}

function SectionIntro({ children }) {
  return <p className="content has-text-centered is-size-5 section-intro">{children}</p>;
}

export default function App() {
  return (
    <section className="section">
      <div className="container has-text-centered">
        <p className="title is-2 paper-title">
          From Geometric Reconstruction to Actionable Scene Understanding for
          Embodied Manipulation: A Survey
        </p>

        <p className="subtitle is-5 paper-venue">Preprint &middot; 2026</p>

        <p className="title is-5 mt-2 authors">
          <a href="https://saltgardenia.github.io/" target="_blank" rel="noreferrer">Yaze Li</a>
          <sup>&dagger;</sup>,{" "}
          <a href="mailto:2024218501@mail.hfut.edu.cn" target="_blank" rel="noreferrer">Xinyu Xie</a>
          <sup>&dagger;</sup>,{" "}
          <a href="mailto:2024218545@mail.hfut.edu.cn" target="_blank" rel="noreferrer">Jiawei Ma</a>
          <sup>&dagger;</sup>,{" "}
          <a href="mailto:2024218492@mail.hfut.edu.cn" target="_blank" rel="noreferrer">Siying Song</a>
          <sup>&dagger;</sup>,{" "}
          <a href="mailto:haihong@mail.hfut.edu.cn" target="_blank" rel="noreferrer">Haihong Xiao</a>
          <sup>*</sup>
        </p>

        <p className="subtitle is-6 affiliation">
          School of Computer Science and Information Engineering, Hefei University
          of Technology, Hefei, China
          <br />
          <span className="muted">
            <sup>&dagger;</sup> Equal contribution &nbsp;&middot;&nbsp;{" "}
            <sup>*</sup> Corresponding author
          </span>
        </p>

        <div className="is-flex is-justify-content-center is-flex-wrap-wrap link-row">
          <span className="icon-text mx-1">
            <a className="button is-dark" href={PAPER_PDF} target="_blank" rel="noreferrer">
              <span className="icon">
                <ion-icon name="document-outline"></ion-icon>
              </span>
              <span> Paper </span>
            </a>
          </span>
          <span className="icon-text mx-1">
            <a className="button is-dark" href={ARXIV_URL} target="_blank" rel="noreferrer">
              <span className="icon">
                <ion-icon name="library-outline"></ion-icon>
              </span>
              <span> arXiv </span>
            </a>
          </span>
          <span className="icon-text mx-1">
            <a className="button is-dark" href={CODE_URL} target="_blank" rel="noreferrer">
              <span className="icon">
                <ion-icon name="logo-github"></ion-icon>
              </span>
              <span> Code </span>
            </a>
          </span>
          <span className="icon-text mx-1">
            <a className="button is-dark" href="#citation" rel="noreferrer">
              <span className="icon">
                <ion-icon name="copy-outline"></ion-icon>
              </span>
              <span> Cite </span>
            </a>
          </span>
        </div>
      </div>

      <div className="container is-max-desktop has-text-centered">
        {/* Framework overview */}
        <PdfFigure
          label="Unified Framework"
          src={fig("fig_framework")}
          ratio={1.55}
          caption={
            <span>
              <b>
                Unified hierarchical framework of actionable scene understanding
                for embodied indoor manipulation.
              </b>{" "}
              This bottom-up framework rests on a shared data and simulation
              substrate, and stacks four progressively enhanced representation
              layers: geometric reconstruction establishes spatial structure
              (where), semantic understanding attaches interpretable identities
              and relations (what), physical and functional understanding
              provides interaction basis and constraints (how), and unified
              embodied modeling enables predictive planning and executable
              behaviors (what if and do). Cross-cutting dimensions including
              dynamic scenes, multi-agent systems and evaluation protocols run
              through all layers, and a perception–action feedback loop closes
              the cycle by updating scene representations with interaction
              outcomes.
            </span>
          }
        />

        {/* Abstract */}
        <SectionTitle>Abstract</SectionTitle>
        <p className="content is-size-6 has-text-left abstract">
          Recent advances in 3D vision and embodied intelligence are driving a
          transition in indoor scene understanding from geometric reconstruction
          toward representations that support reasoning and physical
          interaction. While existing methods can recover scene geometry and
          semantic information, embodied agents require a deeper understanding
          of functional and physical properties, as well as the ability to
          predict the consequences of actions. This survey reviews the evolution
          of indoor scene understanding from 3D reconstruction to actionable
          scene understanding for embodied manipulation, encompassing geometric
          reconstruction, semantic understanding, functional and physical
          understanding, and their integration into embodied intelligence. We
          examine how scene representations have evolved from describing visible
          structures to supporting semantic interpretation, functional and
          physical reasoning, prediction, and action. Beyond summarizing existing
          methods, we identify four emerging directions: inferring invisible
          environmental states from visual observations, learning through
          physical self-supervision, modeling latent human states, and extending
          embodied intelligence from task completion toward human empowerment.
          These directions highlight the need for physically grounded and
          human-centered scene representations that better support embodied
          reasoning, prediction, and action.
        </p>

        {/* Datasets and Evaluation */}
        <SectionTitle>Datasets &amp; Evaluation Metrics</SectionTitle>
        <SectionIntro>
          We review representative indoor scene datasets and the evaluation
          protocols that measure each capability layer, from geometric and
          semantic accuracy to physical plausibility and task-level success.
        </SectionIntro>

        {/* Geometric Reconstruction */}
        <SectionTitle>Geometric Reconstruction</SectionTitle>
        <SectionIntro>
          We categorize indoor scene reconstruction into offline, feed-forward,
          and online paradigms, tracing their chronological evolution from
          explicit geometry to continuous, feed-forward scene representations.
        </SectionIntro>
        <PdfFigure
          label="Taxonomy & Evolution"
          src={fig("fig2")}
          ratio={1.5}
          caption={
            "Taxonomy and chronological evolution of indoor scene reconstruction. Offline reconstruction, feed-forward reconstruction, and online reconstruction are organized as the three major paradigms, with representative methods arranged chronologically within their corresponding technical families."
          }
        />
        <PdfFigure
          label="Representative Results"
          src={fig("fig3v12")}
          ratio={1.5}
          caption={
            "Representative examples of offline, feed-forward, and online 3D reconstruction paradigms."
          }
        />

        {/* Semantic Understanding */}
        <SectionTitle>Semantic Understanding</SectionTitle>
        <SectionIntro>
          Reconstructed geometry is progressively transformed into structured
          semantic representations—from object-level perception and relational
          modeling to open-vocabulary understanding and unified
          geometry–semantic representations.
        </SectionIntro>
        <PdfFigure
          label="Semantic Evolution"
          src={fig("semantic_evo")}
          ratio={1.5}
          caption={
            <span>
              This four-layer bottom-up framework progressively transforms
              reconstructed 3D geometry into structured semantic representations,
              evolving from object-level perception and relational modeling to
              open-vocabulary semantic understanding and unified geometry–semantic
              representation. It establishes the semantic foundation for
              subsequent physical and functional reasoning, thereby bridging
              geometric scene reconstruction and actionable scene understanding
              for embodied manipulation.
            </span>
          }
        />

        {/* Physical and Functional Understanding */}
        <SectionTitle>Physical &amp; Functional Understanding</SectionTitle>
        <SectionIntro>
          Beyond appearance and semantics, agents must reason about physical
          properties, affordances, interaction consequences, and physical
          consistency to act reliably in the real world.
        </SectionIntro>
        <PdfFigure
          label="Pipeline"
          src={fig("fig4b")}
          ratio={1.4}
          caption={
            "Pipeline for generating physically grounded, simulation-ready object representations from visual observations."
          }
        />
        <PdfFigure
          label="Conceptual Framework"
          src={fig("fig4a")}
          ratio={1.4}
          caption={
            "Conceptual framework for physical and functional understanding of indoor scenes."
          }
        />

        {/* Executable Embodied Manipulation */}
        <SectionTitle>Executable Embodied Manipulation</SectionTitle>
        <SectionIntro>
          The upper layers integrate multimodal reasoning, spatial and task-level
          decision making, action generation, and predictive modeling into unified
          embodied agents that close the perception–action loop.
        </SectionIntro>
        <PdfFigure
          label="Embodied Intelligence"
          src={fig("fig_embodied_intelligence")}
          ratio={1.5}
          caption={
            "Executable embodied manipulation integrates multimodal scene reasoning, decision making, action generation, and predictive modeling into a closed perception–action loop."
          }
        />
        <PdfFigure
          label="Unified Modeling"
          src={fig("embodied_unified_modeling")}
          ratio={1.5}
          caption={
            "Unified embodied modeling toward generalist embodied agents that map multimodal perception to manipulation."
          }
        />

        {/* Future Directions */}
        <SectionTitle>Conclusion &amp; Future Directions</SectionTitle>
        <SectionIntro>
          We highlight four emerging directions that point toward physically
          grounded and human-centered scene representations.
        </SectionIntro>
        <PdfFigure
          label="Future Directions"
          src={fig("fig_future_directions")}
          ratio={1.3}
          caption={
            "Four future directions for embodied indoor scene understanding: inferring invisible environmental states, learning through physical self-supervision, modeling latent human states, and extending embodied intelligence from task completion toward human empowerment."
          }
        />

        {/* Citation */}
        <div className="card mt-6 cite-card" id="citation">
          <header className="card-header">
            <p className="card-header-title">Citation</p>
            <CopyButton text={BIBTEX} />
          </header>
          <div className="card-content has-text-left">
            <pre className="bibtex">
              <code>{BIBTEX}</code>
            </pre>
          </div>
        </div>

        <p className="footer-note mt-6">
          &copy; 2026 Survey Project Page &middot; Built with React &amp; Bulma,
          inspired by the DreamGaussian project page.
        </p>
      </div>
    </section>
  );
}
