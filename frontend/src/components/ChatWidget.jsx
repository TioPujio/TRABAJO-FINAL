import { useEffect, useState } from "react";
import "./ChatWidget.css";
import { API_URL } from "../services/api";

export default function ChatWidget({ presetMessage }) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { from: "fer", text: "Hola 👋 soy FER, ¿qué estás buscando hoy?" }
  ]);

  useEffect(() => {
    if (presetMessage) {
      setInput(presetMessage);
    }
  }, [presetMessage]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { from: "user", text: input };
    const messageToSend = input;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: messageToSend })
      });

      const data = await res.json();
      const ferMsg = { from: "fer", text: data.reply };
      setMessages((prev) => [...prev, ferMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, { from: "fer", text: "Error al conectar con FER 😓" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`chat ${open ? "open" : "closed"}`}>
      <div className="chat-header" onClick={() => setOpen(!open)}>
        🤖 FER
      </div>

      {open && (
        <>
          <div className="chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.from}`}>
                {m.text}
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Escribí tu consulta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage} disabled={loading}>
              {loading ? "..." : "Enviar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
