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
        <div style={{ padding: "40px", textAlign: "center", marginTop: "50px", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#333" }}>Oops! Something went wrong.</h2>
          <p style={{ color: "#d32f2f", backgroundColor: "#ffebee", padding: "10px", borderRadius: "4px", display: "inline-block" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <br />
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: "20px", 
              padding: "10px 20px", 
              cursor: "pointer",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px"
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// THIS IS THE CRITICAL LINE WE LIKELY MISSED:
export default ErrorBoundary;