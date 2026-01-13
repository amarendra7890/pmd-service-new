import { LightningElement, track, api } from "lwc";

export default class ColorGradient extends LightningElement {
//   @api
//   numberValue = 50; // Default value
  @track colorStyle = "";
  @api
  title;

  @track value = 100;

  connectedCallback() {
    this.updateColorStyle();
  }

    @api
    get numberValue() {
        return this.value;
    }

    set numberValue(value) {
        this.value = value;
        this.updateColorStyle();
    }

  handleNumberChange(event) {
    this.updateColorStyle();
  }

  updateColorStyle() {
    const value = this.value;

    // Ensure the value is within the range 1-100
    const normalizedValue = Math.max(1, Math.min(100, value));

    // Calculate the color based on the value
    const red = Math.max(
      0,
      Math.min(255, Math.floor((100 - normalizedValue) * 2.55))
    ); // Red decreases as value increases
    const green = Math.max(
      0,
      Math.min(255, Math.floor(normalizedValue * 2.55))
    ); // Green increases as value increases

    this.colorStyle = `color: rgb(${red}, ${green}, 0);`;
  }
}