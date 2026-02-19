 import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Logs the error to your console for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", marginTop: "10vh", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#1e293b", marginBottom: 10 }}>Oops! Something went wrong.</h2>
          <p style={{ color: "#ef4444", backgroundColor: "#fef2f2", padding: "12px 20px", borderRadius: "8px", display: "inline-block", border: "1px solid #fca5a5" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <br />
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: "25px", 
              padding: "12px 24px", 
              cursor: "pointer",
              background: "#1e88e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "15px",
              boxShadow: "0 4px 6px rgba(30, 136, 229, 0.2)"
            }}
          >
            🔄 Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;