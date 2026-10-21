import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import TicketDetail from "@/pages/TicketDetail";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import KPIs from "./pages/KPIs";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

function Router() {
  return <Switch>
    <Route path="/login" component={Login} />
    <Route path="/reset-password" component={ResetPassword} />
    <Route path="/" component={Home} />
    <Route path="/my-tickets" component={Home} />
    <Route path="/tickets" component={Home} />
    <Route path="/tickets/:id" component={TicketDetail} />
    <Route path="/kpis" component={KPIs} />
    <Route path="/admin" component={Admin} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
