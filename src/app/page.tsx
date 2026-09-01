"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className={styles.page}>
      <div className={styles.chat}>
        <h1 className={styles.title}>Eve</h1>
        <p className={styles.subtitle}>
          A Vercel AI SDK agent with persistent memory powered by Neo4j
          Agent Memory (NAMS).
        </p>

        <div className={styles.messages}>
          {messages.map((message) => (
            <div key={message.id} className={styles.message}>
              <strong>{message.role === "user" ? "You:" : "Eve:"}</strong>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <span key={index}>{part.text}</span>
                ) : null,
              )}
            </div>
          ))}
        </div>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!input.trim()) return;
            sendMessage({ text: input });
            setInput("");
          }}
        >
          <input
            className={styles.input}
            value={input}
            placeholder="Say hello to Eve..."
            onChange={(event) => setInput(event.target.value)}
            disabled={isBusy}
          />
          <button className={styles.button} type="submit" disabled={isBusy}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
