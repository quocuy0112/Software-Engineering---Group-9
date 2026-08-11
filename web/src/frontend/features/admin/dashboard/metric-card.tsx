"use client";
import { Card, CardActionArea, CardContent, Typography } from "@mui/material";

export function MetricCard(props: {
  label: string;
  value: number;
  unit: string;
  calculatedAt: string;
  onOpen?: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea
        onClick={props.onOpen}
        aria-label={`Open ${props.label} drill-down`}
      >
        <CardContent>
          <Typography component="h2" variant="subtitle1">
            {props.label}
          </Typography>
          <Typography component="p" variant="h4">
            {props.value.toLocaleString()}
          </Typography>
          <Typography component="p">
            Unit: {props.unit.toLowerCase()}
          </Typography>
          <Typography component="p" variant="caption">
            Calculated {new Date(props.calculatedAt).toLocaleString()}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
