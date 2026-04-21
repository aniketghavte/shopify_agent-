"""Python REPL tool for data analysis + charting.

Uses PythonAstREPLTool which only executes top-level AST nodes.
Matplotlib is forced onto the headless 'Agg' backend. Charts are
captured via a save_chart() helper injected into the REPL locals.

NOTE: this REPL runs in-process. It's fine for the assignment /
local dev but you'd want a subprocess jail for anything hostile.
"""

from __future__ import annotations

import base64
import io
from typing import Any, Dict, List, Tuple

import matplotlib

matplotlib.use("Agg")  # must happen before importing pyplot
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from langchain_experimental.tools.python.tool import PythonAstREPLTool  # noqa: E402


def build_python_tool() -> Tuple[PythonAstREPLTool, List[Dict[str, Any]]]:
    """Return a fresh PythonAstREPLTool plus its captured charts list.

    The returned list is mutated in-place as the agent calls
    save_chart(). Read it after the agent finishes.
    """
    captured: List[Dict[str, Any]] = []

    def save_chart(title: str = "Chart") -> str:
        """Save the current matplotlib figure and return its id.

        Usage inside the REPL:

            import matplotlib.pyplot as plt
            plt.bar(labels, values)
            plt.title("Revenue by city")
            save_chart("Revenue by city")
        """
        fig = plt.gcf()
        if not fig.get_axes():
            return "no_chart_saved: current figure is empty"
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=120)
        plt.close(fig)
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode("ascii")
        cid = f"chart_{len(captured) + 1}"
        captured.append(
            {
                "id": cid,
                "title": title,
                "mime": "image/png",
                "data_base64": b64,
            }
        )
        return cid

    local_ns: Dict[str, Any] = {
        "pd": pd,
        "np": np,
        "plt": plt,
        "save_chart": save_chart,
        # "datetime": datetime,   # TODO: expose if the agent starts asking for it
    }

    tool = PythonAstREPLTool(
        locals=local_ns,
        description=(
            "A Python sandbox for data analysis and charting. Pre-imported: "
            "pandas as pd, numpy as np, matplotlib.pyplot as plt. "
            "Use `save_chart('title')` AFTER plotting to persist a figure "
            "that the UI will render. Print any values you want to observe; "
            "the repl returns stdout. NEVER attempt network / file / os access."
        ),
    )
    return tool, captured
