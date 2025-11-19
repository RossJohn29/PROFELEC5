//About.jsx
import React, { useState, useEffect } from "react";
import "../../Styles/About.css";
import PreAssessmentForm from "./PreAssessmentForm";
import LogoImg from "../../Images/Auth Images/Logo.jpg";
import Pic1 from "../../Images/About Images/About1.jpg";
import Pic2 from "../../Images/About Images/About2.jpg";
import Pic3 from "../../Images/About Images/About3.jpg";
import Pic4 from "../../Images/About Images/About4.jpg";
import M1 from "../../Images/About Images/Sean.jpg";
import M2 from "../../Images/About Images/Alexis.png";
import M3 from "../../Images/About Images/Coleen.png";
import M4 from "../../Images/About Images/Cha.jpg";
import M5 from "../../Images/About Images/Charm.jpg";
import M6 from "../../Images/About Images/Trixie.jpg";

const About = () => {
  const slideImgs = [LogoImg, Pic1, Pic2, Pic3, Pic4];
  const [current, setCurrent] = useState(0);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showPreAssess, setShowPreAssess] = useState(false);

  // autoplay effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slideImgs.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [slideImgs.length]);

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        {/* Background Slider */}
        <div className="slides">
          {slideImgs.map((src, i) => (
            <div className={`slide ${i === current ? "active" : ""}`} key={i}>
              <img src={src} alt={`Slide ${i + 1}`} />
            </div>
          ))}
        </div>

        <div className="overlay"></div>

        {/* Auth buttons */}
        <div className="auth-buttons">
          <a href="/register" className="auth-btn">Sign In</a>
          <a href="/login" className="auth-btn">Log In</a>
        </div>

          <div className="about-hero-container hero-split">
          <div className="hero-left">
            <h1>About Our Telemedicine Platform "THERAPH"</h1>
            <div className="text-with-divider">
              <p>
                We are committed to providing accessible, efficient, and reliable
                healthcare through modern telemedicine solutions. Our system helps
                connect patients and doctors seamlessly.
              </p>
              <div className="hero-divider"></div>
            </div>
          </div>
          <div className="hero-right">
            <h1>Assess Yourself</h1>
            <p>Have a quick pre-assessment to help you determine your current mental state</p>
            <button className="pre-assess-btn" onClick={() => setShowPreAssess(true)}>
               Pre-Assessment
             </button>
          </div>
        </div>
        <div className="dots">
          {slideImgs.map((_, i) => (
            <span
              key={i}
              className={`dot ${i === current ? "active" : ""}`}
              onClick={() => setCurrent(i)}
            ></span>
          ))}
        </div>
      </section>
      {showPreAssess && (
        <div className="modal-overlay" onClick={() => setShowPreAssess(false)}>
          <div className="modal-content square" onClick={(e) => e.stopPropagation()}>
            <PreAssessmentForm onClose={() => setShowPreAssess(false)} />
          </div>
        </div>
      )}

      {/* Our Story */}
      <section className="our-story">
        <h2>Our Story</h2>
        <div className="story-cards">
          <div className="story-card">
            <h3>Our Mission</h3>
            <p>
              To make healthcare accessible anytime, anywhere through innovative
              digital solutions.
            </p>
          </div>
          <div className="story-card">
            <h3>Our Vision</h3>
            <p>
              To revolutionize healthcare delivery by bridging the gap between
              patients and medical professionals.
            </p>
          </div>
        </div>
      </section>

      {/* Our Team */}
      <section className="our-team">
        <h2>Meet the Team</h2>
        <p className="team-intro">
          TheraPH is made in hopes that people who struggle in the darkness may find 
          the light that sparks the flicker of hope inside them.
        </p>
        <div className="team-grid">
          {[
            { img: M1, name: "Sean Paustine Salvador", role: "Lead Developer" },
            { img: M2, name: "Alexis Liane Noda", role: "Developer" },
            { img: M3, name: "Frances Coleen Del Monte", role: "Developer" },
            { img: M4, name: "Trisha Uyao", role: "Documentation" },
            { img: M5, name: "Charmain Guevarra", role: "Documentation" },
            { img: M6, name: "Trixie Guillang", role: "Documentation" }
          ].map((m, i) => (
            <div key={i} className="team-card">
              <img src={m.img} alt={m.name} />
              <h4>{m.name}</h4>
              <p>{m.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-left">
            <h3>THERAPH System</h3>
            <p>Empowering healthcare through technology.</p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="/">Home</a>
            <a href="/About">About</a>
          </div>
          <div className="footer-contact">
            <h4>Contact</h4>
            <p>Email: ourtheraph@gmail.com</p>
            <p>Phone: +63 994 4535 281</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2025 THERAPH System | All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default About;