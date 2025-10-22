import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders main application title", () => {
  render(<App />);
  expect(
    screen.getByText(/Crime Themes Explorer/i)
  ).toBeInTheDocument();
});
