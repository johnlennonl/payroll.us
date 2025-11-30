import React from "react";
import LogoPrincipal from "../assets/LogoPrincipal.png";
import LogoSmall from "../assets/logo.png";
import Ico from "../assets/icoico.png";
import UndrawDev from "../assets/undraw_developer-avatar_f6ac.svg";

export default function Brand({ variant = "logo", size = "md", className = "" }) {
  const sizeMap = {
    sm: "w-10",
    md: "w-24",
    lg: "w-40",
  };
  const sizeClass = sizeMap[size] || sizeMap.md;

  if (variant === "icon") {
    return <img src={Ico} alt="icon" className={`${sizeClass} ${className} object-contain`} />;
  }

  if (variant === "small" ) {
    return <img src={LogoSmall} alt="logo" className={`${sizeClass} ${className} object-contain`} />;
  }

  if (variant === "undraw") {
    return <img src={UndrawDev} alt="illustration" className={`${sizeClass} ${className} object-contain`} />;
  }

  // default: full logo
  return <img src={LogoPrincipal} alt="logo" className={`${sizeClass} ${className} object-contain`} />;
}
