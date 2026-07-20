import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test scaffold", () => { it("renders DOM content", () => { render(<button>Continue</button>); expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument(); }); });
