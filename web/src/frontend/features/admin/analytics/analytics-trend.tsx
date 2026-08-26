"use client";

import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

export type AnalyticsTrendPoint = {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
};

export function AnalyticsTrend({
  title,
  description,
  points,
  formatValue,
}: {
  title: string;
  description: string;
  points: AnalyticsTrendPoint[];
  formatValue: (value: number | null) => string;
}) {
  const maximum = Math.max(
    1,
    ...points.map((point) => (point.value === null ? 0 : point.value)),
  );

  return (
    <Card variant="outlined" component="section" aria-labelledby={title}>
      <CardContent>
        <Typography id={title} component="h2" variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
        {points.length === 0 ? (
          <Typography
            role="status"
            color="text.secondary"
            sx={{ py: 7, textAlign: "center" }}
          >
            No data is available for this reporting window.
          </Typography>
        ) : (
          <>
            <Box
              role="img"
              aria-label={title + " chart"}
              sx={{
                display: "flex",
                alignItems: "stretch",
                gap: { xs: 0.5, sm: 1 },
                height: 220,
                mt: 3,
                px: { xs: 0, sm: 1 },
                overflowX: "auto",
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              {points.map((point) => {
                const height =
                  point.value === null
                    ? 0
                    : Math.max(4, (point.value / maximum) * 100);
                return (
                  <Stack
                    key={point.key}
                    justifyContent="flex-end"
                    alignItems="center"
                    sx={{ minWidth: { xs: 48, sm: 64 }, flex: 1 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.5, whiteSpace: "nowrap" }}
                    >
                      {point.displayValue}
                    </Typography>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: "min(34px, 70%)",
                        height: height + "%",
                        minHeight: point.value === null ? 0 : 4,
                        bgcolor: "primary.main",
                        borderRadius: "6px 6px 0 0",
                        transition: "height 160ms ease",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 1,
                        maxWidth: 72,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={point.label}
                    >
                      {point.label}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
            <Divider sx={{ mt: 2 }} />
            <TableContainer sx={{ maxHeight: 260 }}>
              <Table size="small" stickyHeader aria-label={title + " data"}>
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {points.map((point) => (
                    <TableRow key={point.key}>
                      <TableCell component="th" scope="row">
                        {point.label}
                      </TableCell>
                      <TableCell align="right">
                        {formatValue(point.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
