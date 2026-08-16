import type { AutomaticMatchInput } from "../domain/automatic-match-calculator";
import { calculateAutomaticMatch } from "../domain/automatic-match-calculator";

export class AutomaticMatchService {
  calculate(input: AutomaticMatchInput) {
    return calculateAutomaticMatch(input);
  }
}
