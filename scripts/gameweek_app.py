"""Small window: pick a GameWeek and download all 40 Opta feeds.

Launch by double-clicking Download GameWeek.bat in the FPL folder.
"""

from __future__ import annotations

import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import ttk

sys.path.insert(0, str(Path(__file__).resolve().parent))

from download_feeds import GameWeekResult, download_gameweek  # noqa: E402

WEEKS = [f"GameWeek{n}" for n in range(1, 39)]


class GameWeekApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("הורדת פידים")
        self.root.resizable(False, False)
        self.root.configure(padx=24, pady=20)

        style = ttk.Style()
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Title.TLabel", font=("Segoe UI", 16, "bold"))
        style.configure("Hint.TLabel", font=("Segoe UI", 11))
        style.configure("Status.TLabel", font=("Segoe UI", 11))
        style.configure("Go.TButton", font=("Segoe UI", 12))

        ttk.Label(self.root, text="הורדת פידים", style="Title.TLabel").grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 16)
        )

        ttk.Label(self.root, text="GameWeek", style="Hint.TLabel").grid(
            row=1, column=0, sticky="w", padx=(0, 12)
        )
        self.week = tk.StringVar(value="GameWeek1")
        self.picker = ttk.Combobox(
            self.root,
            textvariable=self.week,
            values=WEEKS,
            state="readonly",
            width=18,
            font=("Segoe UI", 12),
        )
        self.picker.grid(row=1, column=1, sticky="ew")

        self.button = ttk.Button(
            self.root, text="הורד", style="Go.TButton", command=self.start_download
        )
        self.button.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(18, 12), ipady=4)

        self.status = tk.StringVar(value="בוחרים מחזור ולוחצים הורד")
        self.status_label = ttk.Label(
            self.root,
            textvariable=self.status,
            style="Status.TLabel",
            wraplength=380,
            justify="right",
        )
        self.status_label.grid(row=3, column=0, columnspan=2, sticky="ew")

        self.root.columnconfigure(1, weight=1)
        self._busy = False
        self._center()

    def _center(self) -> None:
        self.root.update_idletasks()
        width, height = 440, 210
        x = (self.root.winfo_screenwidth() - width) // 2
        y = (self.root.winfo_screenheight() - height) // 3
        self.root.geometry(f"{width}x{height}+{x}+{y}")

    def start_download(self) -> None:
        if self._busy:
            return
        label = self.week.get()
        try:
            gameweek = int(label.removeprefix("GameWeek"))
        except ValueError:
            self._show(f"בחירה לא תקינה: {label}", error=True)
            return
        self._busy = True
        self.button.state(["disabled"])
        self.picker.configure(state="disabled")
        self._show("מתחיל…")

        def work() -> None:
            def on_progress(index: int, total: int, team: str) -> None:
                self.root.after(
                    0,
                    lambda i=index, t=total, name=team: self._show(f"{i}/{t}  ·  {name}"),
                )

            try:
                result = download_gameweek(gameweek, on_progress=on_progress)
            except Exception as exc:  # noqa: BLE001
                message = str(exc)
                self.root.after(0, lambda: self._finish_error(message))
                return
            self.root.after(0, lambda: self._finish(result))

        threading.Thread(target=work, daemon=True).start()

    def _show(self, text: str, error: bool = False) -> None:
        self.status.set(text)
        self.status_label.configure(foreground="#9b1c1c" if error else "#1a1a1a")

    def _unlock(self) -> None:
        self._busy = False
        self.button.state(["!disabled"])
        self.picker.configure(state="readonly")

    def _finish(self, result: GameWeekResult) -> None:
        self._unlock()
        if result.stopped:
            self._show(
                f"נעצר אחרי {result.saved}/{result.total}. {result.error}",
                error=True,
            )
            return
        self._show(f"נשמרו {result.saved}/{result.total}\n{result.dest}")

    def _finish_error(self, message: str) -> None:
        self._unlock()
        self._show(message, error=True)

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    GameWeekApp().run()


if __name__ == "__main__":
    main()
