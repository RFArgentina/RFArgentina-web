import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6 py-16">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-center">
            <h1 className="text-2xl font-bold mb-3">Hubo un problema</h1>
            <p className="text-slate-600 mb-6">
              Ocurrio un error inesperado. Recarga la pagina y volve a intentar.
            </p>
            <button
              type="button"
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
