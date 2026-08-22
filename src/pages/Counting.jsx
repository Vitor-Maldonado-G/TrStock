import React from "react";
import { useParams } from "react-router-dom";
import PlaceholderScreen from "../components/PlaceholderScreen";

export default function Counting() {
  const { categoria } = useParams();
  return <PlaceholderScreen title={`Contagem: ${categoria}`} />;
}
