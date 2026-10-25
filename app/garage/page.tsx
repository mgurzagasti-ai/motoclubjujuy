import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GaragePage } from "@/components/garage-page";

export default function GarageRoute() {
  return <><Navbar /><main className="container"><GaragePage /></main><Footer /></>;
}
