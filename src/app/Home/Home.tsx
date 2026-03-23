import Header from "@/components/Header";
import Banner from "@/app/Home/Banner";
import FAQ from "@/app/Home/FAQ";
import TestimonialModal from "@/app/Home/Testimonials";

export default function home() {
  return (
    <>
      <main className=" mx-auto w-screen page-main">
        <Header />
        <Banner />
        <FAQ />
        <TestimonialModal />
      </main>
    </>
  );
}
