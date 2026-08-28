import "vuetify/styles"
import { createVuetify } from "vuetify"
import * as components from "vuetify/components"
import * as directives from "vuetify/directives"

const customTheme = {
  colors: {
    primary: "#212121",
    secondary: "#616161",
    background: "#f2f2f2",
    surface: "#ffffff",
  }
}

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "customTheme",
    themes: { customTheme }
  },
})